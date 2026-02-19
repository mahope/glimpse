"use client"

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { CwvBadge } from './PerfBadges'
import { Skeleton } from '@/components/ui/skeleton'

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [strategy, page])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Latest snapshot per URL</div>
        <Select value={strategy} onValueChange={(v: 'MOBILE' | 'DESKTOP') => { setPage(1); setStrategy(v) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Strategy" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MOBILE">Mobile</SelectItem>
            <SelectItem value="DESKTOP">Desktop</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-destructive">{error}</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No performance snapshots yet. Run a test to get started.</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>LCP</TableHead>
                <TableHead>INP</TableHead>
                <TableHead>CLS</TableHead>
                <TableHead>TTFB</TableHead>
                <TableHead>Perf</TableHead>
                <TableHead>Snapshot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="max-w-[420px] truncate">
                    <a className="text-blue-600 hover:underline dark:text-blue-400" href={it.url} target="_blank" rel="noreferrer">{it.url}</a>
                  </TableCell>
                  <TableCell>
                    {it.lcpMs != null ? `${Math.round(it.lcpMs)} ms` : '—'}
                    {it.lcpMs != null && <span className="ml-1"><CwvBadge type="lcp" value={it.lcpMs} /></span>}
                  </TableCell>
                  <TableCell>
                    {it.inpMs != null ? `${Math.round(it.inpMs)} ms` : '—'}
                    {it.inpMs != null && <span className="ml-1"><CwvBadge type="inp" value={it.inpMs} /></span>}
                  </TableCell>
                  <TableCell>
                    {it.cls != null ? it.cls.toFixed(2) : '—'}
                    {it.cls != null && <span className="ml-1"><CwvBadge type="cls" value={it.cls} /></span>}
                  </TableCell>
                  <TableCell>{it.ttfbMs != null ? `${Math.round(it.ttfbMs)} ms` : '—'}</TableCell>
                  <TableCell>{it.perfScore != null ? it.perfScore : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(it.snapshotTime).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
