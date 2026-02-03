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

export function KeywordTable({ items, onFilter }: { items: KeywordRow[]; onFilter?: (f: { device: string; country: string }) => void }) {
  const [device, setDevice] = React.useState('all')
  const [country, setCountry] = React.useState('all')

  React.useEffect(() => { onFilter?.({ device, country }) }, [device, country])

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
            <th>Clicks</th>
            <th>Impr.</th>
            <th>CTR</th>
            <th>Avg Pos.</th>
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
