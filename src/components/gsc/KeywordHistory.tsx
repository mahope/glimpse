"use client"

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

type HistoryPoint = {
  date: string
  clicks: number
  impressions: number
  position: number
  siteAvgPosition: number
}

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '365d', days: 365 },
] as const

export function KeywordHistory({ siteId, keyword, days: initialDays = 90 }: { siteId: string; keyword: string; days?: number }) {
  const [selectedDays, setSelectedDays] = useState(initialDays)
  const [data, setData] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/sites/${siteId}/gsc/keywords/${encodeURIComponent(keyword)}/history?days=${selectedDays}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(d => setData(d.timeline || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [siteId, keyword, selectedDays])

  const summary = useMemo(() => {
    if (data.length === 0) return null
    const positions = data.map(d => d.position).filter(p => p > 0)
    return {
      bestPosition: positions.length > 0 ? Math.min(...positions) : 0,
      avgPosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 0,
      totalClicks: data.reduce((sum, d) => sum + d.clicks, 0),
    }
  }, [data])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[200px] rounded" />
        <Skeleton className="h-[200px] rounded" />
      </div>
    )
  }

  if (error) return <div className="text-sm text-destructive py-4 text-center">{error}</div>
  if (data.length === 0) return <div className="text-sm text-muted-foreground py-4 text-center">Ingen historik tilgængelig for dette keyword.</div>

  const dateFormatter = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('da-DK', { month: 'short', day: 'numeric' })
  }

  const tooltipLabel = (date: string) => {
    return new Date(date).toLocaleDateString('da-DK', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Periode:</span>
        <div className="flex rounded-md border overflow-hidden">
          {PERIOD_OPTIONS.map(opt => (
            <button
              type="button"
              key={opt.days}
              onClick={() => setSelectedDays(opt.days)}
              className={`px-3 py-1.5 text-sm ${selectedDays === opt.days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Bedste position</div>
            <div className="text-lg font-semibold">{summary.bestPosition.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Gns. position</div>
            <div className="text-lg font-semibold">{summary.avgPosition.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Total klik</div>
            <div className="text-lg font-semibold">{summary.totalClicks.toLocaleString('da-DK')}</div>
          </div>
        </div>
      )}

      {/* Position chart */}
      <div>
        <div className="text-sm font-medium mb-2">Position over tid</div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={dateFormatter} />
              <YAxis tick={{ fontSize: 11 }} reversed domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip labelFormatter={tooltipLabel} formatter={(value: number, name: string) => [
                value.toFixed(1),
                name === 'position' ? 'Keyword' : 'Site gns.',
              ]} />
              <Legend formatter={(value) => value === 'position' ? 'Keyword position' : 'Site gennemsnit'} />
              <Line type="monotone" dataKey="position" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="siteAvgPosition" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Clicks + impressions chart */}
      <div>
        <div className="text-sm font-medium mb-2">Klik og visninger</div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={dateFormatter} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={tooltipLabel} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="Klik" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="impressions" name="Visninger" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
