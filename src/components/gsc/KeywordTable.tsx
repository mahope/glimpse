"use client"
import React from 'react'
import { TrendBadge } from './TrendBadge'

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

export function KeywordTable({ items, onFilter, sortField, sortDir, onSort }:
  { items: KeywordRow[]; onFilter?: (f: { device: string; country: string }) => void; sortField?: string; sortDir?: 'asc'|'desc'; onSort?: (f: string, dir: 'asc'|'desc') => void }) {
  const [device, setDevice] = React.useState('all')
  const [country, setCountry] = React.useState('all')

  React.useEffect(() => { onFilter?.({ device, country }) }, [device, country])

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
    <div className="space-y-3">
      <div className="flex gap-2">
        <select className="border rounded px-2 py-1" value={device} onChange={e => setDevice(e.target.value)}>
          <option value="all">All devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
        </select>
        <input value={country} onChange={e=>setCountry(e.target.value)} className="border rounded px-2 py-1" placeholder="Country (ALL/DK/US)" />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Query</th>
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
            <tr key={row.query} className="border-b hover:bg-gray-50">
              <td className="py-2">{row.query}</td>
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
    </div>
  )
}
