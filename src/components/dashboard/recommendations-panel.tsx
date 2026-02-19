'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, AlertCircle, Lightbulb, X, Check } from 'lucide-react'

type Severity = 'critical' | 'important' | 'suggestion'

interface Recommendation {
  id: string
  severity: Severity
  category: string
  title: string
  description: string
  metric?: string
  value?: number
}

const severityConfig: Record<Severity, { icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-[#ff4e42]', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', label: 'Kritisk' },
  important: { icon: AlertCircle, color: 'text-[#ffa400]', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', label: 'Vigtigt' },
  suggestion: { icon: Lightbulb, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', label: 'Forslag' },
}

export function RecommendationsPanel({ siteId }: { siteId: string }) {
  const [recs, setRecs] = useState<Recommendation[] | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`recs-dismissed-${siteId}`)
      if (stored) return new Set(JSON.parse(stored))
    } catch { /* ignore */ }
    return new Set()
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sites/${siteId}/recommendations`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(d => setRecs(d.recommendations))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false))
  }, [siteId])

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(`recs-dismissed-${siteId}`, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [siteId])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Anbefalinger</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-32 rounded" /></CardContent>
      </Card>
    )
  }

  const visible = recs?.filter(r => !dismissed.has(r.id)) ?? []

  if (visible.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anbefalinger</CardTitle>
          <CardDescription>Ingen anbefalinger lige nu</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-[#0cce6b]" />
            Alt ser godt ud!
          </div>
        </CardContent>
      </Card>
    )
  }

  const criticalCount = visible.filter(r => r.severity === 'critical').length
  const importantCount = visible.filter(r => r.severity === 'important').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Anbefalinger</CardTitle>
            <CardDescription>
              {criticalCount > 0 && <span className="text-[#ff4e42]">{criticalCount} kritiske</span>}
              {criticalCount > 0 && importantCount > 0 && ' · '}
              {importantCount > 0 && <span className="text-[#ffa400]">{importantCount} vigtige</span>}
              {criticalCount === 0 && importantCount === 0 && `${visible.length} forslag`}
            </CardDescription>
          </div>
          {dismissed.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setDismissed(new Set())
                try { localStorage.removeItem(`recs-dismissed-${siteId}`) } catch { /* ignore */ }
              }}
            >
              Vis alle
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visible.map(rec => {
            const config = severityConfig[rec.severity]
            const Icon = config.icon
            return (
              <div key={rec.id} className={`rounded-lg border p-3 ${config.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                    <div>
                      <div className="text-sm font-medium">{rec.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{rec.description}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => dismiss(rec.id)}
                    title="Afvis"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
