"use client"

import { useEffect, useState } from 'react'

export type DailyItem = {
  date: string
  lcpPctl?: number | null
  inpPctl?: number | null
  clsPctl?: number | null
  perfScoreAvg?: number | null
  pagesMeasured: number
}

export function PerfTrends({ siteId, days = 30 }: { siteId: string; days?: number }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<DailyItem[]>([])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/sites/${siteId}/perf/daily?days=${days}`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setItems(data.items)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [siteId, days])

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading trends…</div>
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>
  if (!items.length) return <div className="p-4 text-sm text-gray-500">No daily data yet.</div>

  // Render minimal KPI list for now (charts possible with recharts already installed)
  const latest = items[items.length - 1]

  return (
    <div className="grid md:grid-cols-4 gap-3">
      <div className="rounded border p-3">
        <div className="text-xs text-gray-500">Avg Perf Score</div>
        <div className="text-2xl font-semibold">{latest?.perfScoreAvg ?? '—'}</div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-gray-500">LCP p75</div>
        <div className="text-2xl font-semibold">{latest?.lcpPctl != null ? `${latest.lcpPctl} ms` : '—'}</div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-gray-500">INP p75</div>
        <div className="text-2xl font-semibold">{latest?.inpPctl != null ? `${latest.inpPctl} ms` : '—'}</div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-gray-500">CLS p75</div>
        <div className="text-2xl font-semibold">{latest?.clsPctl != null ? latest.clsPctl : '—'}</div>
      </div>
    </div>
  )
}
