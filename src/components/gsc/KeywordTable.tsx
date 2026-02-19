"use client"
import React from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TrendBadge } from './TrendBadge'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

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
}

function SortIcon({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 ml-1 inline-block opacity-50" />
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 ml-1 inline-block" />
    : <ChevronDown className="h-3 w-3 ml-1 inline-block" />
}

export function KeywordTable({ items, onFilter, sortField, sortDir, onSort }:
  { items: KeywordRow[]; onFilter?: (f: { device: string; country: string }) => void; sortField?: string; sortDir?: 'asc' | 'desc'; onSort?: (f: string, dir: 'asc' | 'desc') => void }) {
  const [device, setDevice] = React.useState('all')
  const [country, setCountry] = React.useState('all')

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

      {items.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No keywords found for the selected filters.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.query}>
                <TableCell className="font-medium">{row.query}</TableCell>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
