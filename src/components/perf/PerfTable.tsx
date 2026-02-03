"use client"

import { useEffect, useMemo, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CwvBadge } from './PerfBadges'

export type LatestItem = {
  id: string
  url: string
  strategy: 'MOBILE' | 'DESKTOP'
  lcpMs?: number | null
  inpMs?: number | null
  cls?: number | null
  ttfbMs?: number | null
  perfScore?: number | null
  snapshotTime: string
}

export function PerfTable({ siteId }: { siteId: string }) {
  const [strategy, setStrategy] = useState<'MOBILE' | 'DESKTOP'>('MOBILE')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<LatestItem[]>([])
  const [totalPages, setTotalPages] = useState(1)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sites/${siteId}/perf/latest?strategy=${strategy}&page=${page}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(data.items)
      setTotalPages(data.pagination.totalPages)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [strategy, page])

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading latest snapshots…</div>
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>
  if (!items.length) return <div className="p-4 text-sm text-gray-500">No snapshots yet.</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Latest snapshot per URL</div>
        <div className="flex items-center gap-2">
          <Select value={strategy} onValueChange={(v: any) => { setPage(1); setStrategy(v) }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Strategy" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MOBILE">Mobile</SelectItem>
              <SelectItem value="DESKTOP">Desktop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2 pr-4">URL</th>
              <th className="py-2 pr-4">LCP</th>
              <th className="py-2 pr-4">INP</th>
              <th className="py-2 pr-4">CLS</th>
              <th className="py-2 pr-4">TTFB</th>
              <th className="py-2 pr-4">Perf</th>
              <th className="py-2 pr-4">Snapshot</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="py-2 pr-4 max-w-[420px] truncate"><a className="text-blue-600 hover:underline" href={it.url} target="_blank" rel="noreferrer">{it.url}</a></td>
                <td className="py-2 pr-4">{it.lcpMs != null ? `${Math.round(it.lcpMs)} ms` : '—'} <span className="ml-1 align-middle"><CwvBadge type="lcp" value={it.lcpMs ?? undefined} /></span></td>
                <td className="py-2 pr-4">{it.inpMs != null ? `${Math.round(it.inpMs)} ms` : '—'} <span className="ml-1 align-middle"><CwvBadge type="inp" value={it.inpMs ?? undefined} /></span></td>
                <td className="py-2 pr-4">{it.cls != null ? it.cls.toFixed(2) : '—'} <span className="ml-1 align-middle"><CwvBadge type="cls" value={it.cls ?? undefined} /></span></td>
                <td className="py-2 pr-4">{it.ttfbMs != null ? `${Math.round(it.ttfbMs)} ms` : '—'}</td>
                <td className="py-2 pr-4">{it.perfScore != null ? `${it.perfScore}` : '—'}</td>
                <td className="py-2 pr-4">{new Date(it.snapshotTime).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} className="text-sm px-3 py-1 rounded border disabled:opacity-50">Prev</button>
        <div className="text-xs text-gray-600">Page {page} / {totalPages}</div>
        <button disabled={page>=totalPages} onClick={() => setPage(p => p+1)} className="text-sm px-3 py-1 rounded border disabled:opacity-50">Next</button>
      </div>
    </div>
  )
}
