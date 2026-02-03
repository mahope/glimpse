"use client"
import React from 'react'
import { TrendBadge } from './TrendBadge'

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

export function PageTable({ items, sortField, sortDir, onSort }:
  { items: PageRow[]; sortField?: string; sortDir?: 'asc'|'desc'; onSort?: (f: string, dir: 'asc'|'desc') => void }) {
  const toggleSort = (field: string) => {
    if (!onSort) return
    const dir: 'asc'|'desc' = sortField === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'
    onSort(field, dir)
  }
  const Arrow = ({ active, dir }: { active: boolean; dir?: 'asc'|'desc' }) => (
    <span className="ml-1 inline-block align-middle" aria-hidden data-testid={`arrow-${active?dir:'off'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Page</th>
          <th>
            <button data-testid="sort-clicks" className="hover:underline" onClick={()=>toggleSort('clicks')}>
              Clicks <Arrow active={sortField==='clicks'} dir={sortDir} />
            </button>
          </th>
          <th>
            <button data-testid="sort-impressions" className="hover:underline" onClick={()=>toggleSort('impressions')}>
              Impr. <Arrow active={sortField==='impressions'} dir={sortDir} />
            </button>
          </th>
          <th>
            <button data-testid="sort-ctr" className="hover:underline" onClick={()=>toggleSort('ctr')}>
              CTR <Arrow active={sortField==='ctr'} dir={sortDir} />
            </button>
          </th>
          <th>
            <button data-testid="sort-position" className="hover:underline" onClick={()=>toggleSort('position')}>
              Avg Pos. <Arrow active={sortField==='position'} dir={sortDir} />
            </button>
          </th>
          <th>Trends</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.pageUrl} className="border-b hover:bg-gray-50">
            <td className="py-2 max-w-[420px] truncate"><a href={row.pageUrl} target="_blank" className="text-blue-600 hover:underline">{row.pageUrl}</a></td>
            <td>{row.clicks30}</td>
            <td>{row.impressions30}</td>
            <td>{row.ctr30.toFixed(1)}%</td>
            <td>{row.position30.toFixed(1)}</td>
            <td className="space-x-1">
              <TrendBadge value={row.trendClicks} />
              <TrendBadge value={row.trendImpressions} />
              <TrendBadge value={row.trendCtr} />
              <TrendBadge value={-row.trendPosition} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
