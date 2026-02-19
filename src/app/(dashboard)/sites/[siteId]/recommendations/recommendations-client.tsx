'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, AlertCircle, Lightbulb, Check, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { toast } from '@/components/ui/toast'

type Severity = 'critical' | 'important' | 'suggestion'
type Category = 'performance' | 'content' | 'search' | 'technical'

interface Recommendation {
  id: string
  severity: Severity
  category: Category
  title: string
  description: string
  metric?: string
  value?: number
}

const severityConfig: Record<Severity, { icon: typeof AlertTriangle; color: string; bg: string; label: string; border: string }> = {
  critical: { icon: AlertTriangle, color: 'text-[#ff4e42]', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', label: 'Kritisk' },
  important: { icon: AlertCircle, color: 'text-[#ffa400]', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', label: 'Vigtigt' },
  suggestion: { icon: Lightbulb, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', label: 'Forslag' },
}

const categoryLabels: Record<Category, string> = {
  performance: 'Performance',
  content: 'Indhold',
  search: 'Søgning',
  technical: 'Teknisk',
}

export function RecommendationsClient({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`recs-dismissed-${siteId}`)
      if (stored) return new Set(JSON.parse(stored))
    } catch { /* ignore */ }
    return new Set()
  })
  const [showDismissed, setShowDismissed] = useState(false)
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')

  const fetchRecs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/recommendations`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setRecs(d.recommendations)
      if (showRefresh) toast('success', 'Anbefalinger opdateret')
    } catch {
      toast('error', 'Kunne ikke hente anbefalinger')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [siteId])

  useEffect(() => { fetchRecs() }, [fetchRecs])

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(`recs-dismissed-${siteId}`, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [siteId])

  const restore = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.delete(id)
      try { localStorage.setItem(`recs-dismissed-${siteId}`, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [siteId])

  const clearDismissed = useCallback(() => {
    setDismissed(new Set())
    try { localStorage.removeItem(`recs-dismissed-${siteId}`) } catch { /* ignore */ }
  }, [siteId])

  const activeRecs = recs.filter(r => !dismissed.has(r.id))
  const dismissedRecs = recs.filter(r => dismissed.has(r.id))
  const filtered = (showDismissed ? recs : activeRecs).filter(r => filterCategory === 'all' || r.category === filterCategory)

  const criticalCount = activeRecs.filter(r => r.severity === 'critical').length
  const importantCount = activeRecs.filter(r => r.severity === 'important').length
  const suggestionCount = activeRecs.filter(r => r.severity === 'suggestion').length

  const categories = [...new Set(recs.map(r => r.category))]

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Anbefalinger — {siteName}</h1>
          <p className="text-sm text-muted-foreground">Prioriterede forslag til at forbedre din SEO.</p>
        </div>
        <div className="flex items-center gap-2">
          {dismissed.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowDismissed(!showDismissed)}>
              {showDismissed ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showDismissed ? 'Skjul løste' : `Vis løste (${dismissed.size})`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchRecs(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={criticalCount > 0 ? 'border-red-300 dark:border-red-800' : ''}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${criticalCount > 0 ? 'text-[#ff4e42]' : 'text-muted-foreground'}`} />
              <div>
                <div className="text-2xl font-semibold">{criticalCount}</div>
                <div className="text-xs text-muted-foreground">Kritiske</div>
              </div>
            </CardContent>
          </Card>
          <Card className={importantCount > 0 ? 'border-amber-300 dark:border-amber-800' : ''}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <AlertCircle className={`h-5 w-5 ${importantCount > 0 ? 'text-[#ffa400]' : 'text-muted-foreground'}`} />
              <div>
                <div className="text-2xl font-semibold">{importantCount}</div>
                <div className="text-xs text-muted-foreground">Vigtige</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Lightbulb className={`h-5 w-5 ${suggestionCount > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} />
              <div>
                <div className="text-2xl font-semibold">{suggestionCount}</div>
                <div className="text-xs text-muted-foreground">Forslag</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrer:</span>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 text-sm ${filterCategory === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            >
              Alle
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-sm ${filterCategory === cat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {showDismissed ? 'Alle anbefalinger' : 'Aktive anbefalinger'}
              <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span>
            </CardTitle>
            {dismissed.size > 0 && showDismissed && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={clearDismissed}>
                Gendan alle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check className="h-10 w-10 text-[#0cce6b] mb-3" />
              <p className="text-sm font-medium">Alt ser godt ud!</p>
              <p className="text-xs text-muted-foreground mt-1">Ingen aktive anbefalinger for dette site.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(rec => {
                const config = severityConfig[rec.severity]
                const Icon = config.icon
                const isDismissed = dismissed.has(rec.id)

                return (
                  <div key={rec.id} className={`rounded-lg border p-4 ${config.bg} ${config.border} ${isDismissed ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{rec.title}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                              {categoryLabels[rec.category]}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                          {rec.metric && rec.value != null && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {rec.metric}: <span className="font-mono">{typeof rec.value === 'number' ? rec.value.toLocaleString('da-DK', { maximumFractionDigits: 1 }) : rec.value}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => isDismissed ? restore(rec.id) : dismiss(rec.id)}
                      >
                        {isDismissed ? 'Gendan' : 'Marker som løst'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
