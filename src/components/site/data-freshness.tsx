'use client'

import { useEffect, useState } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

interface FreshnessData {
  gsc: { date: string; syncedAt: string } | null
  perf: { date: string } | null
  crawl: { date: string } | null
}

const STALE_MS = 48 * 60 * 60 * 1000 // 48 hours

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return 'lige nu'
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'lige nu'
  if (diffMin < 60) return `${diffMin} min siden`
  if (diffHours < 24) return `${diffHours}t siden`
  if (diffDays === 1) return 'i går'
  if (diffDays < 7) return `${diffDays} dage siden`
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

function isStale(dateStr: string): boolean {
  return new Date().getTime() - new Date(dateStr).getTime() > STALE_MS
}

export function DataFreshness({ siteId }: { siteId: string }) {
  const [data, setData] = useState<FreshnessData | null>(null)

  useEffect(() => {
    fetch(`/api/sites/${siteId}/freshness`)
      .then(res => res.ok ? res.json() : null)
      .then(setData)
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') console.warn('[DataFreshness] Failed to fetch:', err)
      })
  }, [siteId])

  if (!data) return null

  // Pick the most recent sync date across all data sources
  const dates: string[] = []
  if (data.gsc?.syncedAt) dates.push(data.gsc.syncedAt)
  if (data.perf?.date) dates.push(data.perf.date)
  if (data.crawl?.date) dates.push(data.crawl.date)

  if (dates.length === 0) return null

  const latest = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
  const stale = isStale(latest)

  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${stale ? 'text-amber-600' : 'text-muted-foreground'}`}
      role={stale ? 'alert' : undefined}
    >
      {stale ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        {stale ? 'Data kan være forældet — ' : 'Sidst opdateret: '}
        {formatRelative(latest)}
      </span>
    </div>
  )
}
