"use client"
import React from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ScrollableTable } from '@/components/ui/table'
import { TrendBadge } from './TrendBadge'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export type PageRow = {
  pageUrl: string
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

export function PageTable({ items, sortField, sortDir, onSort }:
  { items: PageRow[]; sortField?: string; sortDir?: 'asc' | 'desc'; onSort?: (f: string, dir: 'asc' | 'desc') => void }) {
  const toggleSort = (field: string) => {
    if (!onSort) return
    const dir: 'asc' | 'desc' = sortField === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'
    onSort(field, dir)
  }

  if (items.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No pages found for the selected filters.</div>
  }

  return (
    <>
    {/* Mobile card view */}
    <div className="md:hidden space-y-2">
      {items.map((row) => {
        const path = (() => {
          try { return new URL(row.pageUrl).pathname } catch { return row.pageUrl }
        })()
        return (
          <a
            key={row.pageUrl}
            href={row.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border p-3 space-y-2 active:bg-accent/50"
          >
            <div className="font-medium text-sm text-blue-600 dark:text-blue-400 truncate">{path}</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Klik</div>
                <div className="font-medium">{row.clicks30.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Visn.</div>
                <div className="font-medium">{row.impressions30.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">CTR</div>
                <div className="font-medium">{row.ctr30.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pos.</div>
                <div className="font-medium">{row.position30.toFixed(1)}</div>
              </div>
            </div>
          </a>
        )
      })}
    </div>

    {/* Desktop table view */}
    <ScrollableTable className="hidden md:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
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
          <TableRow key={row.pageUrl}>
            <TableCell className="max-w-[420px] truncate">
              <a href={row.pageUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{row.pageUrl}</a>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </ScrollableTable>
    </>
  )
}
