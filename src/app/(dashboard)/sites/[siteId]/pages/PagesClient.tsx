"use client"
import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageTable, type PageRow } from '@/components/gsc/PageTable'

type ApiResp = { items: PageRow[]; page: number; pageSize: number; totalItems: number; totalPages: number; sortField: string; sortDir: 'asc'|'desc' }

export default function PagesClient({ siteId, initial }: { siteId: string; initial: ApiResp }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = React.useState<PageRow[]>(initial.items || [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(Number(searchParams.get('page') || initial.page || 1))
  const [pageSize, setPageSize] = React.useState(Number(searchParams.get('pageSize') || initial.pageSize || 50))
  const [days, setDays] = React.useState(Number(searchParams.get('days') || 30))
  const [sortField, setSortField] = React.useState<string>(searchParams.get('sort') || initial.sortField || 'clicks')
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>((searchParams.get('dir') as any) || initial.sortDir || 'desc')
  const [totalPages, setTotalPages] = React.useState<number>(initial.totalPages || 1)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ days: String(days), page: String(page), pageSize: String(pageSize), sort: sortField, dir: sortDir })
      const res = await fetch(`/api/sites/${siteId}/gsc/pages?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json: ApiResp = await res.json()
      setItems(json.items || [])
      setTotalPages(json.totalPages || 1)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [siteId, days, page, pageSize, sortField, sortDir])

  React.useEffect(() => { fetchData() }, [fetchData])

  React.useEffect(() => {
    const sp = new URLSearchParams()
    sp.set('days', String(days))
    sp.set('page', String(page))
    sp.set('pageSize', String(pageSize))
    sp.set('sort', sortField)
    sp.set('dir', sortDir)
    router.replace(`?${sp.toString()}`)
  }, [days, page, pageSize, sortField, sortDir])

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <select className="border rounded px-2 py-1" value={days} onChange={e=>setDays(Number(e.target.value))}>
          <option value={7}>7d</option>
          <option value={30}>30d</option>
          <option value={90}>90d</option>
        </select>
        <select className="border rounded px-2 py-1" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && items.length === 0 && <div className="text-sm text-gray-500">No data</div>}

      <PageTable
        items={items}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, dir)=>{ setSortField(f); setSortDir(dir) }}
      />

      <div className="flex items-center gap-2">
        <button className="border rounded px-2 py-1" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <button className="border rounded px-2 py-1" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
      </div>
    </div>
  )
}
