'use client'

import { useEffect, useState } from 'react'
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { ClicksChart } from "@/components/charts/clicks-chart"
import { PositionChart } from "@/components/charts/position-chart"
import { TopKeywords } from "@/components/dashboard/top-keywords"
import { TopPages } from "@/components/dashboard/top-pages"
import { PerformanceOverview } from "@/components/dashboard/performance-overview"
import { HealthScoreWidget } from "@/components/dashboard/health-score-widget"
import { Skeleton } from "@/components/ui/skeleton"

interface DashboardData {
  kpis: {
    clicks: { value: number; deltaPct: number }
    impressions: { value: number; deltaPct: number }
    ctr: { value: number; deltaPct: number }
    position: { value: number; deltaPct: number }
  }
  timeline: Array<{ date: string; clicks: number; impressions: number; position: number }>
  topKeywords: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>
  topPages: Array<{ pageUrl: string; clicks: number; impressions: number; ctr: number; position: number }>
  performance: { overallScore: number | null; lcp: number | null; inp: number | null; cls: number | null; siteCount: number } | null
  siteCount: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dashboard data')
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of your SEO performance across all connected sites</p>
        </div>
        <div className="rounded-lg border p-8 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-sm text-primary underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of your SEO performance across all connected sites</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[380px] rounded-lg" />
          <Skeleton className="h-[380px] rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your SEO performance across {data.siteCount} connected site{data.siteCount !== 1 ? 's' : ''}
        </p>
      </div>

      <KpiCards data={data.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClicksChart data={data.timeline} />
        <PositionChart data={data.timeline} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceOverview data={data.performance} />
        <HealthScoreWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopKeywords data={data.topKeywords} />
        <TopPages data={data.topPages} />
      </div>
    </div>
  )
}
