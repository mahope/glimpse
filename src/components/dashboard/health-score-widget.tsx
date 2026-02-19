'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

interface SiteHealth {
  id: string
  name: string
  domain: string
  health: number
  components: {
    psi: number
    alerts: number
    crawl: number
    gscTrend: number
  }
  openAlerts: number
  psiScore: number | null
}

function healthColor(score: number) {
  if (score >= 80) return 'text-[#0cce6b]'
  if (score >= 60) return 'text-[#ffa400]'
  return 'text-[#ff4e42]'
}

function healthBg(score: number) {
  if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
  if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
  return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
}

function HealthIcon({ score }: { score: number }) {
  if (score >= 80) return <CheckCircle className="h-5 w-5 text-[#0cce6b]" />
  if (score >= 60) return <AlertCircle className="h-5 w-5 text-[#ffa400]" />
  return <AlertTriangle className="h-5 w-5 text-[#ff4e42]" />
}

function ComponentBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-[#0cce6b]' : value >= 60 ? 'bg-[#ffa400]' : 'bg-[#ff4e42]'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <span className="w-6 text-right tabular-nums">{value}</span>
    </div>
  )
}

export function HealthScoreWidget() {
  const [sites, setSites] = useState<SiteHealth[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/health')
      .then(res => {
        if (!res.ok) throw new Error('Kunne ikke hente health data')
        return res.json()
      })
      .then(d => setSites(d.sites))
      .catch(err => { setError(err.message); setSites([]) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Health</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!sites || sites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Health</CardTitle>
          <CardDescription>Ingen sites fundet</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Health</CardTitle>
        <CardDescription>Sorteret efter sites der kræver opmærksomhed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sites.map(site => (
            <Link
              key={site.id}
              href={`/sites/${site.id}/overview`}
              className={`block rounded-lg border p-4 transition-colors hover:opacity-80 ${healthBg(site.health)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HealthIcon score={site.health} />
                  <div>
                    <div className="font-medium text-sm">{site.name}</div>
                    <div className="text-xs text-muted-foreground">{site.domain}</div>
                  </div>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${healthColor(site.health)}`}>
                  {site.health}
                </div>
              </div>
              <div className="space-y-1.5">
                <ComponentBar label="Performance" value={site.components.psi} />
                <ComponentBar label="Alerts" value={site.components.alerts} />
                <ComponentBar label="Crawl" value={site.components.crawl} />
                <ComponentBar label="GSC Trend" value={site.components.gscTrend} />
              </div>
              {site.openAlerts > 0 && (
                <div className="mt-2 text-xs text-[#ff4e42] flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {site.openAlerts} åben{site.openAlerts !== 1 ? 'e' : ''} alert{site.openAlerts !== 1 ? 's' : ''}
                </div>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
