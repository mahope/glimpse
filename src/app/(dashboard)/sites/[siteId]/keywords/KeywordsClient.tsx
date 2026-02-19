"use client"
import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeywordTable, type KeywordRow } from '@/components/gsc/KeywordTable'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Download, Search, Plus, X, Tag } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { DateRangePicker, dateRangeFromSearchParams, dateRangeToSearchParams, dateRangeToParams, type DateRangeValue } from '@/components/ui/date-range-picker'

type ApiResp = { items: KeywordRow[]; page: number; pageSize: number; totalItems: number; totalPages: number; sortField: string; sortDir: 'asc'|'desc' }
type TagItem = { id: string; name: string; color: string; _count: { assignments: number } }

type PositionFilter = '' | 'top3' | 'top10' | 'top20' | '50plus'

const POSITION_FILTERS: { label: string; value: PositionFilter }[] = [
  { label: 'Alle', value: '' },
  { label: 'Top 3', value: 'top3' },
  { label: 'Top 10', value: 'top10' },
  { label: 'Top 20', value: 'top20' },
  { label: '50+', value: '50plus' },
]

const TAG_SUGGESTIONS = [
  { name: 'Branded', color: '#3b82f6' },
  { name: 'Commercial', color: '#10b981' },
  { name: 'Informational', color: '#8b5cf6' },
  { name: 'Lokale', color: '#f59e0b' },
]

export default function KeywordsClient({ siteId, initial }: { siteId: string; initial: ApiResp }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = React.useState<KeywordRow[]>(initial.items || [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(Number(searchParams.get('page') || initial.page || 1))
  const [pageSize, setPageSize] = React.useState(Number(searchParams.get('pageSize') || initial.pageSize || 50))
  const [dateRange, setDateRange] = React.useState<DateRangeValue>(() => dateRangeFromSearchParams(searchParams, 30))
  const [device, setDevice] = React.useState<string>(searchParams.get('device') || 'all')
  const [country, setCountry] = React.useState<string>(searchParams.get('country') || 'ALL')
  const [sortField, setSortField] = React.useState<string>(searchParams.get('sort') || initial.sortField || 'clicks')
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>((searchParams.get('dir') as 'asc' | 'desc') || initial.sortDir || 'desc')
  const [totalPages, setTotalPages] = React.useState<number>(initial.totalPages || 1)
  const [search, setSearch] = React.useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = React.useState(searchParams.get('search') || '')
  const [positionFilter, setPositionFilter] = React.useState<PositionFilter>((searchParams.get('positionFilter') as PositionFilter) || '')
  const [activeTagId, setActiveTagId] = React.useState(searchParams.get('tagId') || '')
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tag management state
  const [tags, setTags] = React.useState<TagItem[]>([])
  const [showTagForm, setShowTagForm] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState('')
  const [newTagColor, setNewTagColor] = React.useState('#6b7280')

  // Fetch tags
  const fetchTags = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/keyword-tags`)
      if (res.ok) {
        const data = await res.json()
        setTags(data.tags || [])
      }
    } catch { /* ignore */ }
  }, [siteId])

  React.useEffect(() => { fetchTags() }, [fetchTags])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ ...dateRangeToParams(dateRange), page: String(page), pageSize: String(pageSize), device, country, sort: sortField, dir: sortDir })
      if (search) qs.set('search', search)
      if (positionFilter) qs.set('positionFilter', positionFilter)
      if (activeTagId) qs.set('tagId', activeTagId)
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
  }, [siteId, dateRange, page, pageSize, device, country, sortField, sortDir, search, positionFilter, activeTagId])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // Debounced search
  const handleSearchInput = React.useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }, [])

  const handlePositionFilter = React.useCallback((value: PositionFilter) => {
    setPositionFilter(value)
    setPage(1)
  }, [])

  const handleTagFilter = React.useCallback((tagId: string) => {
    setActiveTagId(prev => prev === tagId ? '' : tagId)
    setPage(1)
  }, [])

  const createTag = async (name: string, color: string) => {
    try {
      const res = await fetch(`/api/sites/${siteId}/keyword-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast('error', data.error || 'Kunne ikke oprette tag')
        return
      }
      fetchTags()
      setShowTagForm(false)
      setNewTagName('')
    } catch {
      toast('error', 'Kunne ikke oprette tag')
    }
  }

  const deleteTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/sites/${siteId}/keyword-tags?tagId=${tagId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast('error', 'Kunne ikke slette tag')
        return
      }
      if (activeTagId === tagId) setActiveTagId('')
      fetchTags()
      fetchData()
    } catch {
      toast('error', 'Kunne ikke slette tag')
    }
  }

  // keep URL in sync
  React.useEffect(() => {
    const sp = new URLSearchParams()
    dateRangeToSearchParams(sp, dateRange)
    sp.set('page', String(page))
    sp.set('pageSize', String(pageSize))
    sp.set('device', device)
    sp.set('country', country)
    sp.set('sort', sortField)
    sp.set('dir', sortDir)
    if (search) sp.set('search', search)
    if (positionFilter) sp.set('positionFilter', positionFilter)
    if (activeTagId) sp.set('tagId', activeTagId)
    router.replace(`?${sp.toString()}`)
  }, [dateRange, page, pageSize, device, country, sortField, sortDir, search, positionFilter, activeTagId])

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
        <DateRangePicker
          value={dateRange}
          onChange={v => { setDateRange(v); setPage(1) }}
          maxDays={180}
        />
        <select className="border rounded px-2 py-1 text-sm bg-background" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/sites/${siteId}/gsc/keywords/export?${new URLSearchParams({ ...dateRangeToParams(dateRange), device, country, sort: sortField, dir: sortDir, ...(search ? { search } : {}), ...(positionFilter ? { positionFilter } : {}), ...(activeTagId ? { tagId: activeTagId } : {}) }).toString()}`} download>
            <Download className="w-4 h-4 mr-1" /> Eksporter CSV
          </a>
        </Button>
      </div>

      {/* Position quick-filter + tag filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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

        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {tags.map(tag => (
            <button
              type="button"
              key={tag.id}
              onClick={() => handleTagFilter(tag.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity ${activeTagId === tag.id ? 'opacity-100 ring-2 ring-offset-1 ring-primary' : 'opacity-70 hover:opacity-100'}`}
              style={{ backgroundColor: tag.color, color: '#fff' }}
            >
              {tag.name} ({tag._count.assignments})
              {activeTagId === tag.id && (
                <X className="h-3 w-3" onClick={e => { e.stopPropagation(); handleTagFilter('') }} />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowTagForm(!showTagForm)}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            <Plus className="h-3 w-3" /> Tag
          </button>
        </div>
      </div>

      {/* New tag form */}
      {showTagForm && (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
          <input
            type="text"
            placeholder="Tag-navn..."
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-background flex-1"
            onKeyDown={e => e.key === 'Enter' && newTagName.trim() && createTag(newTagName.trim(), newTagColor)}
          />
          <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="h-7 w-7 rounded border cursor-pointer" />
          <Button size="sm" onClick={() => newTagName.trim() && createTag(newTagName.trim(), newTagColor)} disabled={!newTagName.trim()}>
            Opret
          </Button>
          {TAG_SUGGESTIONS.filter(s => !tags.some(t => t.name === s.name)).length > 0 && (
            <div className="flex gap-1 ml-2">
              <span className="text-xs text-muted-foreground self-center">Forslag:</span>
              {TAG_SUGGESTIONS.filter(s => !tags.some(t => t.name === s.name)).map(s => (
                <button type="button" key={s.name} onClick={() => createTag(s.name, s.color)} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white hover:opacity-80" style={{ backgroundColor: s.color }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowTagForm(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

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
          tags={tags}
          onTagAssign={async (tagId, queries) => {
            try {
              const res = await fetch(`/api/sites/${siteId}/keyword-tags/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagId, queries }),
              })
              if (!res.ok) {
                toast('error', 'Kunne ikke tildele tag')
                return
              }
              fetchTags()
              fetchData()
            } catch {
              toast('error', 'Kunne ikke tildele tag')
            }
          }}
        />
      )}

      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
