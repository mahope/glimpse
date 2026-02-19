'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { SiteNav } from '@/components/site/site-nav'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface OverviewData {
  range: { start: string; end: string; days: number }
  kpis: {
    clicks: { value: number; deltaPct: number }
    impressions: { value: number; deltaPct: number }
    ctr: { value: number; deltaPct: number }
    position: { value: number; deltaPct: number }
  }
  timeline: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>
}

function Kpi({ title, value, delta, suffix = '' }: { title: string; value: number; delta: number; suffix?: string }) {
  const positive = title === 'Average Position' ? delta < 0 : delta > 0
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{title === 'Average CTR' ? value.toFixed(2) : value.toLocaleString()}{suffix}</div>
        <div className={`flex items-center text-xs ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
          {positive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {Math.abs(delta).toFixed(1)}% vs prev period
        </div>
      </CardContent>
    </Card>
  )
}

const PERIOD_OPTIONS = [
  { label: '7d', value: '7' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
  { label: '365d', value: '365' },
]

const DEVICE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Mobile', value: 'MOBILE' },
  { label: 'Desktop', value: 'DESKTOP' },
]

export default function OverviewPage() {
  const params = useParams<{ siteId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const days = searchParams.get('days') || '30'
  const device = searchParams.get('device') || 'all'
  const country = searchParams.get('country') || 'ALL'

  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  const updateFilter = useCallback((key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set(key, value)
    router.push(`?${sp.toString()}`, { scroll: false })
  }, [searchParams, router])

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ days, device, country }).toString()
    fetch(`/api/sites/${params.siteId}/overview?${qs}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [params.siteId, days, device, country])

  return (
    <div className="space-y-6">
      <SiteNav siteId={params.siteId} active="overview" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period filter */}
          <div className="flex rounded-md border overflow-hidden">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateFilter('days', opt.value)}
                className={`px-3 py-1.5 text-sm ${days === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Device filter */}
          <div className="flex rounded-md border overflow-hidden">
            {DEVICE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateFilter('device', opt.value)}
                className={`px-3 py-1.5 text-sm ${device === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi title="Total Clicks" value={data.kpis.clicks.value} delta={data.kpis.clicks.deltaPct} />
            <Kpi title="Total Impressions" value={data.kpis.impressions.value} delta={data.kpis.impressions.deltaPct} />
            <Kpi title="Average CTR" value={data.kpis.ctr.value} delta={data.kpis.ctr.deltaPct} suffix="%" />
            <Kpi title="Average Position" value={data.kpis.position.value} delta={data.kpis.position.deltaPct} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {data.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" dot={false} name="Clicks" />
                      <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#3b82f6" dot={false} name="Impressions" />
                      <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#f59e0b" dot={false} name="CTR %" />
                      <Line yAxisId="right" type="monotone" dataKey="position" stroke="#ef4444" dot={false} name="Avg Position" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data available yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
