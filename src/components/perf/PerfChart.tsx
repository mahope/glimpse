"use client"

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { DateRangePicker, dateRangeToParams, type DateRangeValue } from '@/components/ui/date-range-picker'

export type SeriesItem = {
  date: string
  scoreAvg: number | null
  lcp: number | null
  inp: number | null
  cls: number | null
}

export function PerfChart({ siteId, days = 30 }: { siteId: string; days?: number }) {
  const [items, setItems] = useState<SeriesItem[]>([])
  const [device, setDevice] = useState<'ALL'|'MOBILE'|'DESKTOP'>('ALL')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeValue>({ mode: 'preset', days })

  useEffect(() => {
    const run = async () => {
      setLoading(true); setErr(null)
      try {
        const qs = new URLSearchParams({ ...dateRangeToParams(dateRange), device })
        const res = await fetch(`/api/sites/${siteId}/perf/daily?${qs}`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        const mapped = (data.items || []).map((r: any) => ({
          date: typeof r.date === 'string' ? r.date.substring(0,10) : new Date(r.date).toISOString().substring(0,10),
          scoreAvg: r.scoreAvg ?? r.perfScoreAvg ?? null,
          lcp: r.lcp ?? r.lcpPctl ?? null,
          inp: r.inp ?? r.inpPctl ?? null,
          cls: r.cls ?? r.clsPctl ?? null,
        }))
        setItems(mapped)
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [siteId, dateRange, device])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          maxDays={90}
        />
        <select className="border rounded px-2 py-1 text-sm bg-background" value={device} onChange={e => setDevice(e.target.value as 'ALL' | 'MOBILE' | 'DESKTOP')}>
          <option value="ALL">Alle enheder</option>
          <option value="MOBILE">Mobil</option>
          <option value="DESKTOP">Desktop</option>
        </select>
        {loading && <span className="text-xs text-muted-foreground">Indlæser...</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={items} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="scoreAvg" name="Score" stroke="#2563eb" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="lcp" name="LCP (ms p75)" stroke="#16a34a" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="inp" name="INP (ms p75)" stroke="#ca8a04" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="cls" name="CLS (p75)" stroke="#dc2626" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
