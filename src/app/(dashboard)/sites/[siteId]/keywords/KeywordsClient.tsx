"use client"
import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeywordTable, type KeywordRow } from '@/components/gsc/KeywordTable'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Download, Search } from 'lucide-react'

type ApiResp = { items: KeywordRow[]; page: number; pageSize: number; totalItems: number; totalPages: number; sortField: string; sortDir: 'asc'|'desc' }

type PositionFilter = '' | 'top3' | 'top10' | 'top20' | '50plus'

const POSITION_FILTERS: { label: string; value: PositionFilter }[] = [
  { label: 'Alle', value: '' },
  { label: 'Top 3', value: 'top3' },
  { label: 'Top 10', value: 'top10' },
  { label: 'Top 20', value: 'top20' },
  { label: '50+', value: '50plus' },
]

export default function KeywordsClient({ siteId, initial }: { siteId: string; initial: ApiResp }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = React.useState<KeywordRow[]>(initial.items || [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(Number(searchParams.get('page') || initial.page || 1))
  const [pageSize, setPageSize] = React.useState(Number(searchParams.get('pageSize') || initial.pageSize || 50))
  const [days, setDays] = React.useState(Number(searchParams.get('days') || 30))
  const [device, setDevice] = React.useState<string>(searchParams.get('device') || 'all')
  const [country, setCountry] = React.useState<string>(searchParams.get('country') || 'ALL')
  const [sortField, setSortField] = React.useState<string>(searchParams.get('sort') || initial.sortField || 'clicks')
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>((searchParams.get('dir') as any) || initial.sortDir || 'desc')
  const [totalPages, setTotalPages] = React.useState<number>(initial.totalPages || 1)
  const [search, setSearch] = React.useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = React.useState(searchParams.get('search') || '')
  const [positionFilter, setPositionFilter] = React.useState<PositionFilter>((searchParams.get('positionFilter') as PositionFilter) || '')
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ days: String(days), page: String(page), pageSize: String(pageSize), device, country, sort: sortField, dir: sortDir })
      if (search) qs.set('search', search)
      if (positionFilter) qs.set('positionFilter', positionFilter)
      const res = await fetch(`/api/sites/${siteId}/gsc/keywords?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json: ApiResp = await res.json()
      setItems(json.items || [])
      setTotalPages(json.totalPages || 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [siteId, days, page, pageSize, device, country, sortField, sortDir, search, positionFilter])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // Debounced search: update actual search state 300ms after input stops
  const handleSearchInput = React.useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }, [])

  // Reset page when filters change
  const handlePositionFilter = React.useCallback((value: PositionFilter) => {
    setPositionFilter(value)
    setPage(1)
  }, [])

  // keep URL in sync
  React.useEffect(() => {
    const sp = new URLSearchParams()
    sp.set('days', String(days))
    sp.set('page', String(page))
    sp.set('pageSize', String(pageSize))
    sp.set('device', device)
    sp.set('country', country)
    sp.set('sort', sortField)
    sp.set('dir', sortDir)
    if (search) sp.set('search', search)
    if (positionFilter) sp.set('positionFilter', positionFilter)
    router.replace(`?${sp.toString()}`)
  }, [days, page, pageSize, device, country, sortField, sortDir, search, positionFilter])

  return (
    <div className="space-y-3">
      {/* Search + filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Søg keywords..."
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            className="w-full border rounded px-2 py-1 pl-8 text-sm bg-background"
          />
        </div>
        <select className="border rounded px-2 py-1 text-sm bg-background" value={days} onChange={e => { setDays(Number(e.target.value)); setPage(1) }}>
          <option value={7}>7d</option>
          <option value={30}>30d</option>
          <option value={90}>90d</option>
        </select>
        <select className="border rounded px-2 py-1 text-sm bg-background" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/sites/${siteId}/gsc/keywords/export?days=${days}&device=${device}&country=${country}&sort=${sortField}&dir=${sortDir}${search ? `&search=${encodeURIComponent(search)}` : ''}${positionFilter ? `&positionFilter=${positionFilter}` : ''}`} download>
            <Download className="w-4 h-4 mr-1" /> Eksporter CSV
          </a>
        </Button>
      </div>

      {/* Position quick-filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Position:</span>
        <div className="flex rounded-md border overflow-hidden">
          {POSITION_FILTERS.map(opt => (
            <button
              type="button"
              key={opt.value}
              onClick={() => handlePositionFilter(opt.value)}
              className={`px-3 py-1 text-sm ${positionFilter === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      )}
      {error && <div className="py-4 text-center text-destructive">{error}</div>}

      {!loading && !error && (
        <KeywordTable
          items={items}
          siteId={siteId}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(f, dir) => { setSortField(f); setSortDir(dir) }}
          onFilter={({ device, country }) => { setDevice(device); setCountry(country.toUpperCase()); setPage(1) }}
        />
      )}

      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
