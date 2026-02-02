"use client"
import React from 'react'
import { TrendBadge } from './TrendBadge'

export type PageRow = {
  pageUrl: string
  clicks30: number
  impressions30: number
  ctr30: number
  position30: number
  trendClick: number
  trendImpr: number
}

export function PageTable({ items }: { items: PageRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Page</th>
          <th>Clicks</th>
          <th>Impr.</th>
          <th>CTR</th>
          <th>Avg Pos.</th>
          <th>Trend</th>
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
            <td><TrendBadge value={row.trendClick} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
