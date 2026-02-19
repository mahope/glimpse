"use client"
import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageTable, type PageRow } from '@/components/gsc/PageTable'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Download, Search, FolderOpen, ArrowLeft } from 'lucide-react'
import { DateRangePicker, dateRangeFromSearchParams, dateRangeToSearchParams, dateRangeToParams, type DateRangeValue } from '@/components/ui/date-range-picker'

type ApiResp = { items: PageRow[]; page: number; pageSize: number; totalItems: number; totalPages: number; sortField: string; sortDir: 'asc'|'desc' }
type GroupResp = { groups: PathGroup[] }

type PathGroup = {
  path: string
  pageCount: number
  totalClicks: number
  totalImpressions: number
  avgPosition: number
}

export default function PagesClient({ siteId, initial }: { siteId: string; initial: ApiResp }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = React.useState<PageRow[]>(initial.items || [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(Number(searchParams.get('page') || initial.page || 1))
  const [pageSize, setPageSize] = React.useState(Number(searchParams.get('pageSize') || initial.pageSize || 50))
  const [dateRange, setDateRange] = React.useState<DateRangeValue>(() => dateRangeFromSearchParams(searchParams, 30))
  const [sortField, setSortField] = React.useState<string>(searchParams.get('sort') || initial.sortField || 'clicks')
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>((searchParams.get('dir') as 'asc' | 'desc') || initial.sortDir || 'desc')
  const [totalPages, setTotalPages] = React.useState<number>(initial.totalPages || 1)
  const [device, setDevice] = React.useState(searchParams.get('device') || 'all')
  const [country, setCountry] = React.useState(searchParams.get('country') || 'ALL')
  const [countryInput, setCountryInput] = React.useState(searchParams.get('country') || 'ALL')
  const [search, setSearch] = React.useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = React.useState(searchParams.get('search') || '')
  const [pathPrefix, setPathPrefix] = React.useState(searchParams.get('pathPrefix') || '')
  const [showGroups, setShowGroups] = React.useState(false)
  const [pathGroups, setPathGroups] = React.useState<PathGroup[]>([])
  const [debouncing, setDebouncing] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const countryDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        ...dateRangeToParams(dateRange),
        page: String(page),
        pageSize: String(pageSize),
        sort: sortField,
        dir: sortDir,
        device,
        country,
      })
      if (search) qs.set('search', search)
      if (pathPrefix) qs.set('pathPrefix', pathPrefix)
      if (showGroups && !pathPrefix) qs.set('groupBy', 'path')
      const res = await fetch(`/api/sites/${siteId}/gsc/pages?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      if (showGroups && !pathPrefix) {
        const json: GroupResp = await res.json()
        setPathGroups(json.groups || [])
        setItems([])
      } else {
        const json: ApiResp = await res.json()
        setItems(json.items || [])
        setTotalPages(json.totalPages || 1)
        setPathGroups([])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [siteId, dateRange, page, pageSize, sortField, sortDir, device, country, search, pathPrefix, showGroups])

  React.useEffect(() => { fetchData() }, [fetchData])

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (countryDebounceRef.current) clearTimeout(countryDebounceRef.current)
      if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current)
    }
  }, [])

  const handleSearchInput = React.useCallback((value: string) => {
    setSearchInput(value)
    setDebouncing(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
      setDebouncing(false)
    }, 300)
  }, [])

  const handleCountryInput = React.useCallback((value: string) => {
    const upper = value.toUpperCase()
    setCountryInput(upper)
    setDebouncing(true)
    if (countryDebounceRef.current) clearTimeout(countryDebounceRef.current)
    countryDebounceRef.current = setTimeout(() => {
      setCountry(upper)
      setPage(1)
      setDebouncing(false)
    }, 300)
  }, [])

  // keep URL in sync (debounced to reduce router churn)
  React.useEffect(() => {
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current)
    urlDebounceRef.current = setTimeout(() => {
      const sp = new URLSearchParams()
      dateRangeToSearchParams(sp, dateRange)
      sp.set('page', String(page))
      sp.set('pageSize', String(pageSize))
      sp.set('sort', sortField)
      sp.set('dir', sortDir)
      sp.set('device', device)
      sp.set('country', country)
      if (search) sp.set('search', search)
      if (pathPrefix) sp.set('pathPrefix', pathPrefix)
      router.replace(`?${sp.toString()}`)
    }, 150)
  }, [dateRange, page, pageSize, sortField, sortDir, device, country, search, pathPrefix])

  return (
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Søg URLs..."
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            className="w-full border rounded px-2 py-1 pl-8 text-sm bg-background"
          />
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={v => { setDateRange(v); setPage(1) }}
          maxDays={180}
        />
        <select className="border rounded px-2 py-1 text-sm bg-background" value={device} onChange={e => { setDevice(e.target.value); setPage(1) }}>
          <option value="all">Alle enheder</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobil</option>
        </select>
        <input
          value={countryInput}
          onChange={e => handleCountryInput(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-background w-20"
          placeholder="Land"
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {pathPrefix ? (
          <Button variant="outline" size="sm" onClick={() => { setPathPrefix(''); setPage(1) }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Alle sider
          </Button>
        ) : (
          <Button variant={showGroups ? 'secondary' : 'outline'} size="sm" onClick={() => { setShowGroups(!showGroups); setPage(1) }}>
            <FolderOpen className="w-4 h-4 mr-1" /> {showGroups ? 'Vis sider' : 'Gruppér stier'}
          </Button>
        )}
        {pathPrefix && (
          <span className="text-sm text-muted-foreground">Filtrerer: <code className="bg-muted px-1 rounded">{pathPrefix}</code></span>
        )}
        <select className="border rounded px-2 py-1 text-sm bg-background" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/sites/${siteId}/gsc/pages/export?${new URLSearchParams({ ...dateRangeToParams(dateRange), sort: sortField, dir: sortDir, device, country, ...(search ? { search } : {}), ...(pathPrefix ? { pathPrefix } : {}) }).toString()}`} download>
            <Download className="w-4 h-4 mr-1" /> Eksporter CSV
          </a>
        </Button>
      </div>

      {debouncing && !loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
          <div className="h-3 w-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
          Venter på input...
        </div>
      )}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      )}
      {error && <div className="py-4 text-center text-destructive">{error}</div>}

      {!loading && !error && showGroups && !pathPrefix && (
        <div className="space-y-1">
          {pathGroups.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Ingen sider fundet.</div>
          ) : pathGroups.map(g => (
            <button
              key={g.path}
              type="button"
              onClick={() => { setPathPrefix(g.path); setShowGroups(false); setPage(1) }}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <div className="font-medium text-sm">{g.path}</div>
                  <div className="text-xs text-muted-foreground">{g.pageCount} sider</div>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-right">
                <div>
                  <div className="text-muted-foreground">Klik</div>
                  <div className="font-medium">{g.totalClicks.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Visn.</div>
                  <div className="font-medium">{g.totalImpressions.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Gns. pos.</div>
                  <div className="font-medium">{g.avgPosition.toFixed(1)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (!showGroups || pathPrefix) && (
        <PageTable
          items={items}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(f, dir)=>{ setSortField(f); setSortDir(dir) }}
        />
      )}

      {(!showGroups || pathPrefix) && (
        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}
