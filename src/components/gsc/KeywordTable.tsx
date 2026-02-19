"use client"
import React from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { TrendBadge } from './TrendBadge'
import { KeywordHistory } from './KeywordHistory'
import { ChevronUp, ChevronDown, ChevronsUpDown, TrendingUp } from 'lucide-react'

export type KeywordTag = {
  id: string
  name: string
  color: string
}

export type KeywordRow = {
  query: string
  clicks30: number
  impressions30: number
  ctr30: number
  position30: number
  trendClicks: number
  trendImpressions: number
  trendCtr: number
  trendPosition: number
  tags?: KeywordTag[]
}

function SortIcon({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 ml-1 inline-block opacity-50" />
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 ml-1 inline-block" />
    : <ChevronDown className="h-3 w-3 ml-1 inline-block" />
}

export function KeywordTable({ items, siteId, onFilter, sortField, sortDir, onSort, tags, onTagAssign }:
  { items: KeywordRow[]; siteId?: string; onFilter?: (f: { device: string; country: string }) => void; sortField?: string; sortDir?: 'asc' | 'desc'; onSort?: (f: string, dir: 'asc' | 'desc') => void; tags?: KeywordTag[]; onTagAssign?: (tagId: string, queries: string[]) => void }) {
  const [device, setDevice] = React.useState('all')
  const [country, setCountry] = React.useState('all')
  const [selectedKeyword, setSelectedKeyword] = React.useState<string | null>(null)
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())

  React.useEffect(() => { onFilter?.({ device, country }) }, [device, country])

  const toggleSort = (field: string) => {
    if (!onSort) return
    const dir: 'asc' | 'desc' = sortField === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'
    onSort(field, dir)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select className="border rounded px-2 py-1 text-sm bg-background" value={device} onChange={e => setDevice(e.target.value)}>
          <option value="all">All devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
        </select>
        <input value={country} onChange={e => setCountry(e.target.value)} className="border rounded px-2 py-1 text-sm bg-background" placeholder="Country (ALL/DK/US)" />
      </div>

      {/* Bulk tag assign bar */}
      {selectedRows.size > 0 && tags && tags.length > 0 && onTagAssign && (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
          <span className="text-sm">{selectedRows.size} valgt</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            defaultValue=""
            onChange={e => {
              if (e.target.value) {
                onTagAssign(e.target.value, Array.from(selectedRows))
                setSelectedRows(new Set())
                e.target.value = ''
              }
            }}
          >
            <option value="">Tildel tag...</option>
            {tags.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => setSelectedRows(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
            Ryd valg
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">Ingen keywords fundet for de valgte filtre.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {siteId && tags && tags.length > 0 && (
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === items.length && items.length > 0}
                    onChange={e => setSelectedRows(e.target.checked ? new Set(items.map(i => i.query)) : new Set())}
                    className="rounded"
                  />
                </TableHead>
              )}
              <TableHead>Query</TableHead>
              <TableHead>
                <button data-testid="sort-clicks" className="hover:text-foreground inline-flex items-center" onClick={() => toggleSort('clicks')}>
                  Clicks <SortIcon active={sortField === 'clicks'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button data-testid="sort-impressions" className="hover:text-foreground inline-flex items-center" onClick={() => toggleSort('impressions')}>
                  Impr. <SortIcon active={sortField === 'impressions'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button data-testid="sort-ctr" className="hover:text-foreground inline-flex items-center" onClick={() => toggleSort('ctr')}>
                  CTR <SortIcon active={sortField === 'ctr'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button data-testid="sort-position" className="hover:text-foreground inline-flex items-center" onClick={() => toggleSort('position')}>
                  Avg Pos. <SortIcon active={sortField === 'position'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>Trends</TableHead>
              {siteId && <TableHead className="w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.query} className={siteId ? 'cursor-pointer hover:bg-accent/50' : ''} onClick={siteId ? () => setSelectedKeyword(row.query) : undefined}>
                {siteId && tags && tags.length > 0 && (
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.query)}
                      onChange={e => {
                        const next = new Set(selectedRows)
                        e.target.checked ? next.add(row.query) : next.delete(row.query)
                        setSelectedRows(next)
                      }}
                      className="rounded"
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  <span>{row.query}</span>
                  {row.tags && row.tags.length > 0 && (
                    <span className="ml-1.5 inline-flex gap-1">
                      {row.tags.map(tag => (
                        <span key={tag.id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell>{row.clicks30.toLocaleString()}</TableCell>
                <TableCell>{row.impressions30.toLocaleString()}</TableCell>
                <TableCell>{row.ctr30.toFixed(1)}%</TableCell>
                <TableCell>{row.position30.toFixed(1)}</TableCell>
                <TableCell className="space-x-1">
                  <TrendBadge value={row.trendClicks} />
                  <TrendBadge value={row.trendImpressions} />
                  <TrendBadge value={row.trendCtr} />
                  <TrendBadge value={-row.trendPosition} />
                </TableCell>
                {siteId && (
                  <TableCell>
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Keyword history dialog */}
      {siteId && (
        <Dialog open={!!selectedKeyword} onOpenChange={(open) => { if (!open) setSelectedKeyword(null) }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedKeyword}</DialogTitle>
              <DialogDescription>Position, klik og visninger over tid</DialogDescription>
            </DialogHeader>
            {selectedKeyword && <KeywordHistory siteId={siteId} keyword={selectedKeyword} />}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
