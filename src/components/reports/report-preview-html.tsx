'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Download, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReportData, KeywordRow, Issue, CoreWebVitals, TrendPoint, KPI } from '@/lib/reports/types'
import { getPerformanceStatus, getPerformanceColor } from '@/lib/performance/thresholds'

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
}

function KpiCard({ kpi }: { kpi: KPI }) {
  const delta = kpi.delta ?? 0
  const positive = delta > 0
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-sm text-muted-foreground">{kpi.label}</div>
        <div className="text-2xl font-semibold mt-1">
          {typeof kpi.value === 'number' ? kpi.value.toLocaleString('da-DK') : kpi.value}
        </div>
        {delta !== 0 && (
          <div className={`flex items-center text-xs mt-1 ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
            {positive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PerfSection({ perf }: { perf: CoreWebVitals }) {
  const metrics: Array<{ label: string; metric: 'LCP' | 'INP' | 'CLS' | 'TTFB'; value: string; raw: number | undefined }> = [
    { label: 'LCP', metric: 'LCP', value: perf.lcp != null ? `${perf.lcp.toFixed(2)}s` : '—', raw: perf.lcp },
    { label: 'INP', metric: 'INP', value: perf.inp != null ? `${perf.inp}ms` : '—', raw: perf.inp },
    { label: 'CLS', metric: 'CLS', value: perf.cls != null ? perf.cls.toFixed(3) : '—', raw: perf.cls },
    { label: 'TTFB', metric: 'TTFB', value: perf.ttfb != null ? `${perf.ttfb}ms` : '—', raw: perf.ttfb },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Core Web Vitals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map(m => {
            const status = m.raw != null ? getPerformanceStatus(m.metric, m.raw) : undefined
            const color = status ? getPerformanceColor(status) : undefined
            return (
              <div key={m.label} className="text-center p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="text-lg font-semibold mt-1" style={color ? { color } : undefined}>
                  {m.value}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function KeywordsSection({ keywords }: { keywords: KeywordRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top 10 Keywords</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Keyword</th>
                <th className="pb-2 font-medium text-right">Klik</th>
                <th className="pb-2 font-medium text-right">Visn.</th>
                <th className="pb-2 font-medium text-right">CTR</th>
                <th className="pb-2 font-medium text-right">Pos.</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 font-medium">{kw.keyword}</td>
                  <td className="py-2 text-right">{kw.clicks.toLocaleString()}</td>
                  <td className="py-2 text-right">{kw.impressions.toLocaleString()}</td>
                  <td className="py-2 text-right">{(kw.ctr * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right">{kw.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {keywords.map((kw, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="font-medium text-sm mb-2">{kw.keyword}</div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Klik</div>
                  <div className="font-medium">{kw.clicks.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Visn.</div>
                  <div className="font-medium">{kw.impressions.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">CTR</div>
                  <div className="font-medium">{(kw.ctr * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pos.</div>
                  <div className="font-medium">{kw.position.toFixed(1)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function IssuesSection({ issues }: { issues: Issue[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Crawl-problemer</CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen problemer fundet.</p>
        ) : (
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div key={issue.id || i} className="flex items-start gap-3 p-2 rounded border">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low}`}>
                  {issue.severity}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{issue.title}</div>
                  {issue.description && <div className="text-xs text-muted-foreground mt-0.5">{issue.description}</div>}
                  {issue.pagesAffected != null && <div className="text-xs text-muted-foreground">{issue.pagesAffected} sider berørt</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TrendsSection({ trends }: { trends: TrendPoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">30-dages trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => new Date(d).toLocaleDateString('da-DK', { month: 'short', day: 'numeric' })} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={d => new Date(d).toLocaleDateString('da-DK', { month: 'long', day: 'numeric', year: 'numeric' })}
                formatter={(value: number, name: string) => [typeof value === 'number' ? value.toLocaleString('da-DK', { maximumFractionDigits: 1 }) : value, name]}
              />
              <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" dot={false} name="Klik" />
              <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#3b82f6" dot={false} name="Visninger" />
              <Line yAxisId="right" type="monotone" dataKey="position" stroke="#ef4444" dot={false} name="Position" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function ReportPreviewHTML({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/sites/${siteId}/report?format=json`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Kunne ikke hente rapportdata')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [siteId])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  if (error || !data) {
    return <div className="py-8 text-center text-destructive">{error || 'Ingen data'}</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={onClose} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Tilbage til rapporter
          </Button>
          <h2 className="text-xl font-semibold">{data.site.name}</h2>
          <p className="text-sm text-muted-foreground">{data.period.label}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.seoScore != null && (
            <div className="text-center px-4 py-2 rounded-lg border">
              <div className="text-xs text-muted-foreground">SEO Score</div>
              <div className={`text-2xl font-bold ${data.seoScore >= 70 ? 'text-emerald-600' : data.seoScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.seoScore}
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/sites/${siteId}/report`} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </a>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.kpis.map((kpi, i) => <KpiCard key={i} kpi={kpi} />)}
      </div>

      {/* Performance */}
      {data.performance && <PerfSection perf={data.performance} />}

      {/* Trends */}
      {data.trends && data.trends.length > 0 && <TrendsSection trends={data.trends} />}

      {/* Keywords */}
      {data.topKeywords && data.topKeywords.length > 0 && <KeywordsSection keywords={data.topKeywords} />}

      {/* Issues */}
      {data.issues && data.issues.length > 0 && <IssuesSection issues={data.issues} />}
    </div>
  )
}
