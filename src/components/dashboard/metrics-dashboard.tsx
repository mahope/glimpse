'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface MetricsData {
  entities: {
    activeSites: number
    organizations: number
    users: number
  }
  apiLatencies: {
    route: string
    p50: number
    p95: number
    p99: number
    count: number
    avg: number
  }[]
  psi: {
    calls24h: number
    errors24h: number
    errorRate: number
  }
  queues: {
    name: string
    waiting: number
    active: number
    delayed: number
    failed: number
    total: number
  }[]
  crawl: {
    totalDuration24h: number
    totalPages24h: number
    pagesPerSecond: number
  }
  timeSeries: {
    psiCalls: { hour: string; value: number }[]
    psiErrors: { hour: string; value: number }[]
  }
  timestamp: string
}

export function MetricsDashboard() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/admin/metrics')
      if (!response.ok) {
        setError('Failed to load metrics')
        return
      }
      setData(await response.json())
    } catch {
      setError('Could not connect to metrics API')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Loading metrics...</div>
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchMetrics} variant="outline">Retry</Button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Application Metrics</h2>
          <p className="text-muted-foreground">System health and performance overview</p>
        </div>
        <Button onClick={fetchMetrics} variant="outline">Refresh</Button>
      </div>

      {/* Entity Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Active Sites" value={data.entities.activeSites} />
        <StatCard title="Organizations" value={data.entities.organizations} />
        <StatCard title="Users" value={data.entities.users} />
      </div>

      {/* PSI & Crawl Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="PSI Calls (24h)" value={data.psi.calls24h} />
        <StatCard title="PSI Errors (24h)" value={data.psi.errors24h} color={data.psi.errors24h > 0 ? 'text-red-600' : undefined} />
        <StatCard title="PSI Error Rate" value={`${data.psi.errorRate}%`} color={data.psi.errorRate > 10 ? 'text-red-600' : undefined} />
        <StatCard title="Crawl Speed" value={`${data.crawl.pagesPerSecond} pages/s`} subtitle={`${data.crawl.totalPages24h} pages in 24h`} />
      </div>

      {/* PSI Calls Time Series */}
      {data.timeSeries.psiCalls.some(d => d.value > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>PSI Calls (Last 24h)</CardTitle>
            <CardDescription>API calls and errors per hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mergeTimeSeries(data.timeSeries.psiCalls, data.timeSeries.psiErrors)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="calls" stroke="#3b82f6" name="Calls" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Errors" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Queue Depths */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Depths</CardTitle>
          <CardDescription>Current job counts per queue</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.queues}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="waiting" fill="#eab308" name="Waiting" stackId="stack" />
              <Bar dataKey="active" fill="#22c55e" name="Active" stackId="stack" />
              <Bar dataKey="delayed" fill="#f97316" name="Delayed" stackId="stack" />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" stackId="stack" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* API Latencies */}
      {data.apiLatencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>API Response Times (Last Hour)</CardTitle>
            <CardDescription>Percentiles in milliseconds per route</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Route</th>
                    <th className="py-2 px-3 font-medium text-right">Requests</th>
                    <th className="py-2 px-3 font-medium text-right">Avg</th>
                    <th className="py-2 px-3 font-medium text-right">p50</th>
                    <th className="py-2 px-3 font-medium text-right">p95</th>
                    <th className="py-2 px-3 font-medium text-right">p99</th>
                  </tr>
                </thead>
                <tbody>
                  {data.apiLatencies.map((row) => (
                    <tr key={row.route} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{row.route}</td>
                      <td className="py-2 px-3 text-right">{row.count}</td>
                      <td className="py-2 px-3 text-right">{row.avg}ms</td>
                      <td className="py-2 px-3 text-right">{Math.round(row.p50)}ms</td>
                      <td className="py-2 px-3 text-right">
                        <span className={row.p95 > 1000 ? 'text-red-600 font-medium' : ''}>
                          {Math.round(row.p95)}ms
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={row.p99 > 2000 ? 'text-red-600 font-medium' : ''}>
                          {Math.round(row.p99)}ms
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="text-sm text-muted-foreground text-center">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, subtitle, color }: {
  title: string
  value: string | number
  subtitle?: string
  color?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color || ''}`}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}

function mergeTimeSeries(
  calls: { hour: string; value: number }[],
  errors: { hour: string; value: number }[],
) {
  return calls.map((c, i) => ({
    hour: c.hour,
    calls: c.value,
    errors: errors[i]?.value || 0,
  }))
}
