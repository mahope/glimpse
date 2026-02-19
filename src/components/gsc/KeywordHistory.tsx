"use client"

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

type HistoryPoint = {
  date: string
  clicks: number
  impressions: number
  position: number
  siteAvgPosition: number
}

export function KeywordHistory({ siteId, keyword, days = 90 }: { siteId: string; keyword: string; days?: number }) {
  const [data, setData] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/sites/${siteId}/gsc/keywords/${encodeURIComponent(keyword)}/history?days=${days}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(d => setData(d.timeline || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [siteId, keyword, days])

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
