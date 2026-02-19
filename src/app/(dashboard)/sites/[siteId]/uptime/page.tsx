'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SiteNav } from '@/components/site/site-nav'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CheckCircle2, XCircle, Clock, Activity } from 'lucide-react'

interface UptimeData {
  uptimePct: number | null
  avgResponseTime: number | null
  totalChecks: number
  currentStatus: boolean | null
  lastChecked: string | null
  timeline: Array<{ time: string; avgResponseMs: number; checks: number; downCount: number }>
  incidents: Array<{ start: string; end: string; durationMinutes: number; error: string | null }>
}

export default function UptimePage() {
  const params = useParams<{ siteId: string }>()
  const [data, setData] = useState<UptimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('7')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/sites/${params.siteId}/uptime?days=${days}`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [params.siteId, days])

  const uptimeColor = useMemo(() => {
    if (!data?.uptimePct) return 'text-muted-foreground'
    if (data.uptimePct >= 99.9) return 'text-[#0cce6b]'
    if (data.uptimePct >= 99) return 'text-[#ffa400]'
    return 'text-[#ff4e42]'
  }, [data?.uptimePct])

  return (
    <div className="space-y-6">
      <SiteNav siteId={params.siteId} active="uptime" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold">Uptime</h1>
        <div className="flex rounded-md border overflow-hidden">
          {[{ label: '24t', value: '1' }, { label: '7d', value: '7' }, { label: '30d', value: '30' }].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 text-sm ${days === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Ingen uptime-data tilgængelig endnu. Checks kører automatisk hvert 5. minut.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  {data.currentStatus === true ? <CheckCircle2 className="h-4 w-4 text-[#0cce6b]" /> : data.currentStatus === false ? <XCircle className="h-4 w-4 text-[#ff4e42]" /> : null}
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-semibold ${data.currentStatus === true ? 'text-[#0cce6b]' : data.currentStatus === false ? 'text-[#ff4e42]' : ''}`}>
                  {data.currentStatus === true ? 'Online' : data.currentStatus === false ? 'Nede' : '—'}
                </div>
                {data.lastChecked && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Sidst checket: {new Date(data.lastChecked).toLocaleString('da-DK')}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  Uptime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-semibold ${uptimeColor}`}>
                  {data.uptimePct !== null ? `${data.uptimePct.toFixed(2)}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.totalChecks} checks i perioden
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Gns. responstid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {data.avgResponseTime !== null ? `${data.avgResponseTime}ms` : '—'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-semibold ${data.incidents.length > 0 ? 'text-[#ff4e42]' : 'text-[#0cce6b]'}`}>
                  {data.incidents.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.incidents.length === 0 ? 'Ingen nedetid' : `i de seneste ${days === '1' ? '24 timer' : `${days} dage`}`}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Response time chart */}
          {data.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Responstid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 12 }}
                        tickFormatter={t => {
                          const d = new Date(t)
                          return days === '1'
                            ? d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
                            : d.toLocaleDateString('da-DK', { month: 'short', day: 'numeric' })
                        }}
                      />
                      <YAxis tick={{ fontSize: 12 }} unit="ms" />
                      <Tooltip
                        labelFormatter={t => new Date(t).toLocaleString('da-DK')}
                        formatter={(value: number, name: string) => {
                          if (name === 'avgResponseMs') return [`${value}ms`, 'Responstid']
                          return [value, name]
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgResponseMs"
                        stroke="#3b82f6"
                        dot={false}
                        name="Responstid"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Incident log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incident-log</CardTitle>
            </CardHeader>
            <CardContent>
              {data.incidents.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-[#0cce6b]" />
                  Ingen incidents i perioden
                </div>
              ) : (
                <div className="space-y-2">
                  {data.incidents.map((incident, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                      <div>
                        <div className="text-sm font-medium text-[#ff4e42]">
                          Nedetid: {incident.durationMinutes} min
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(incident.start).toLocaleString('da-DK')} — {new Date(incident.end).toLocaleString('da-DK')}
                        </div>
                        {incident.error && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Fejl: {incident.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
