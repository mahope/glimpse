'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { SiteNav } from '@/components/site/site-nav'
import { RecommendationsPanel } from '@/components/dashboard/recommendations-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { DateRangePicker, dateRangeFromSearchParams, dateRangeToSearchParams, dateRangeToParams, type DateRangeValue } from '@/components/ui/date-range-picker'

interface KpiMetric {
  value: number
  deltaPct: number
  compareValue: number
}

interface OverviewData {
  range: { start: string; end: string; days: number }
  compareRange: { start: string; end: string; mode: string } | null
  kpis: {
    clicks: KpiMetric
    impressions: KpiMetric
    ctr: KpiMetric
    position: KpiMetric
  }
  timeline: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>
  compareTimeline: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>
}

type KpiType = 'clicks' | 'impressions' | 'ctr' | 'position'

function Kpi({ type, title, metric, suffix = '', showCompare }: {
  type: KpiType; title: string; metric: KpiMetric; suffix?: string; showCompare: boolean
}) {
  const invertTrend = type === 'position'
  const positive = invertTrend ? metric.deltaPct < 0 : metric.deltaPct > 0
  const fmt = (v: number) =>
    type === 'ctr' ? v.toFixed(2)
    : type === 'position' ? v.toFixed(1)
    : v.toLocaleString()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{fmt(metric.value)}{suffix}</div>
        {showCompare && (
          <>
            <div className={`flex items-center text-xs ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
              {positive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {Math.abs(metric.deltaPct).toFixed(1)}% vs sammenligningsperiode
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Sammenligning: {fmt(metric.compareValue)}{suffix}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

const OVERVIEW_PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '365d', days: 365 },
]

const DEVICE_OPTIONS = [
  { label: 'Alle', value: 'all' },
  { label: 'Mobil', value: 'MOBILE' },
  { label: 'Desktop', value: 'DESKTOP' },
]

const COMPARE_OPTIONS = [
  { label: 'Forrige periode', value: 'prev' },
  { label: 'Samme periode sidste år', value: 'year' },
  { label: 'Ingen sammenligning', value: 'none' },
]

export default function OverviewPage() {
  const params = useParams<{ siteId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const dateRange = dateRangeFromSearchParams(searchParams, 30)
  const device = searchParams.get('device') || 'all'
  const country = searchParams.get('country') || 'ALL'
  const compare = searchParams.get('compare') || 'prev'

  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  const updateFilter = useCallback((key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set(key, value)
    router.push(`?${sp.toString()}`, { scroll: false })
  }, [searchParams, router])

  const handleDateRangeChange = useCallback((value: DateRangeValue) => {
    const sp = new URLSearchParams(searchParams.toString())
    dateRangeToSearchParams(sp, value)
    router.push(`?${sp.toString()}`, { scroll: false })
  }, [searchParams, router])

  // Serialize dateRange for useEffect dependency
  const dateRangeKey = dateRange.mode === 'preset' ? `p:${dateRange.days}` : `c:${dateRange.from}:${dateRange.to}`

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ ...dateRangeToParams(dateRange), device, country, compare }).toString()
    fetch(`/api/sites/${params.siteId}/overview?${qs}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .finally(() => setLoading(false))
  }, [params.siteId, dateRangeKey, device, country, compare])

  // Merge current + comparison timeline for chart overlay
  const mergedTimeline = useMemo(() => {
    if (!data || compare === 'none' || data.compareTimeline.length === 0) return null

    // Align by day index (day 0, day 1, ...) since dates differ
    const maxLen = Math.max(data.timeline.length, data.compareTimeline.length)
    const merged = []
    for (let i = 0; i < maxLen; i++) {
      const curr = data.timeline[i]
      const comp = data.compareTimeline[i]
      merged.push({
        dayIndex: i,
        date: curr?.date ?? '',
        clicks: curr?.clicks ?? null,
        impressions: curr?.impressions ?? null,
        ctr: curr?.ctr ?? null,
        position: curr?.position ?? null,
        compClicks: comp?.clicks ?? null,
        compImpressions: comp?.impressions ?? null,
        compCtr: comp?.ctr ?? null,
        compPosition: comp?.position ?? null,
      })
    }
    return merged
  }, [data, compare])

  const showCompare = compare !== 'none'

  return (
    <div className="space-y-6">
      <SiteNav siteId={params.siteId} active="overview" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold">Overblik</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period filter */}
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            presets={OVERVIEW_PRESETS}
            maxDays={365}
          />

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

          {/* Compare filter */}
          <select
            value={compare}
            onChange={e => updateFilter('compare', e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm bg-background text-foreground"
          >
            {COMPARE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
            <Kpi type="clicks" title="Klik i alt" metric={data.kpis.clicks} showCompare={showCompare} />
            <Kpi type="impressions" title="Visninger i alt" metric={data.kpis.impressions} showCompare={showCompare} />
            <Kpi type="ctr" title="Gns. CTR" metric={data.kpis.ctr} suffix="%" showCompare={showCompare} />
            <Kpi type="position" title="Gns. Position" metric={data.kpis.position} showCompare={showCompare} />
          </div>

          {data.compareRange && (
            <div className="text-xs text-muted-foreground">
              Sammenligningsperiode: {data.compareRange.start} — {data.compareRange.end}
              {data.compareRange.mode === 'year' ? ' (samme periode sidste år)' : ' (forrige periode)'}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {data.timeline.length > 0 ? (
                  mergedTimeline ? (
                    /* Chart with comparison overlay */
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mergedTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={d => d ? new Date(d).toLocaleDateString('da-DK', { month: 'short', day: 'numeric' }) : ''}
                        />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={d => d ? new Date(d).toLocaleDateString('da-DK', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                          formatter={(value: number | null, name: string) => {
                            if (value == null) return ['-', name]
                            return [typeof value === 'number' ? value.toLocaleString('da-DK', { maximumFractionDigits: 1 }) : value, name]
                          }}
                        />
                        <Legend />
                        {/* Current period - solid lines */}
                        <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" dot={false} name="Klik" connectNulls />
                        <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#3b82f6" dot={false} name="Visninger" connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#f59e0b" dot={false} name="CTR %" connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="position" stroke="#ef4444" dot={false} name="Position" connectNulls />
                        {/* Comparison period - dashed lines */}
                        <Line yAxisId="left" type="monotone" dataKey="compClicks" stroke="#10b981" strokeDasharray="5 5" dot={false} name="Klik (sml.)" opacity={0.5} connectNulls />
                        <Line yAxisId="left" type="monotone" dataKey="compImpressions" stroke="#3b82f6" strokeDasharray="5 5" dot={false} name="Visninger (sml.)" opacity={0.5} connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="compCtr" stroke="#f59e0b" strokeDasharray="5 5" dot={false} name="CTR % (sml.)" opacity={0.5} connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="compPosition" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="Position (sml.)" opacity={0.5} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    /* Chart without comparison */
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={d => new Date(d).toLocaleDateString('da-DK', { month: 'short', day: 'numeric' })} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('da-DK', { month: 'long', day: 'numeric', year: 'numeric' })} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" dot={false} name="Klik" />
                        <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#3b82f6" dot={false} name="Visninger" />
                        <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#f59e0b" dot={false} name="CTR %" />
                        <Line yAxisId="right" type="monotone" dataKey="position" stroke="#ef4444" dot={false} name="Position" />
                      </LineChart>
                    </ResponsiveContainer>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Ingen data tilgængelig endnu</div>
                )}
              </div>
            </CardContent>
          </Card>

          <RecommendationsPanel siteId={params.siteId} />
        </>
      )}
    </div>
  )
}
