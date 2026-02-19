"use client"
import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageTable, type PageRow } from '@/components/gsc/PageTable'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

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
        <select className="border rounded px-2 py-1 text-sm bg-background" value={days} onChange={e=>setDays(Number(e.target.value))}>
          <option value={7}>7d</option>
          <option value={30}>30d</option>
          <option value={90}>90d</option>
        </select>
        <select className="border rounded px-2 py-1 text-sm bg-background" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <a href={`/api/sites/${siteId}/gsc/pages/export?days=${days}&sort=${sortField}&dir=${sortDir}`} download>
            <Download className="w-4 h-4 mr-1" /> Eksporter CSV
          </a>
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      )}
      {error && <div className="py-4 text-center text-destructive">{error}</div>}

      {!loading && !error && (
        <PageTable
          items={items}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(f, dir)=>{ setSortField(f); setSortDir(dir) }}
        />
      )}

      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
