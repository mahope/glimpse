'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SiteNav } from '@/components/site/site-nav'
import { toast } from '@/components/ui/toast'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { Plus, Trash2, Loader2, Zap, Search, ArrowUp, ArrowDown, X } from 'lucide-react'

interface PerfData {
  perfScore: number | null
  lcpMs: number | null
  inpMs: number | null
  cls: number | null
  ttfbMs: number | null
  date?: string
}

interface CompetitorEntry {
  id: string
  name: string
  url: string
  latestSnapshot: PerfData | null
}

interface CompetitorsData {
  site: { name: string; domain: string; latestPerf: PerfData | null }
  competitors: CompetitorEntry[]
  maxCompetitors: number
}

interface OverlapKeyword {
  query: string
  sourceClicks: number
  sourceImpressions: number
  sourcePosition: number
  competitorClicks: number
  competitorImpressions: number
  competitorPosition: number
  positionGap: number
}

interface KeywordMetrics {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface KeywordOverlapData {
  available: boolean
  message?: string
  competitorName: string
  competitorUrl: string
  matchedSiteName?: string
  days?: number
  shared?: OverlapKeyword[]
  onlySource?: KeywordMetrics[]
  onlyCompetitor?: KeywordMetrics[]
  summary?: {
    sharedCount: number
    onlySourceCount: number
    onlyCompetitorCount: number
    avgPositionGap: number
    winCount: number
    loseCount: number
  }
}

type OverlapTab = 'shared' | 'onlySource' | 'onlyCompetitor'

function cwvColor(metric: string, value: number | null): string {
  if (value == null) return '#94a3b8' // gray
  if (metric === 'lcp') return value <= 2500 ? '#0cce6b' : value <= 4000 ? '#ffa400' : '#ff4e42'
  if (metric === 'inp') return value <= 200 ? '#0cce6b' : value <= 500 ? '#ffa400' : '#ff4e42'
  if (metric === 'cls') return value <= 0.1 ? '#0cce6b' : value <= 0.25 ? '#ffa400' : '#ff4e42'
  if (metric === 'score') return value >= 90 ? '#0cce6b' : value >= 50 ? '#ffa400' : '#ff4e42'
  return '#94a3b8'
}

function MetricChart({ title, metric, unit, data }: {
  title: string; metric: string; unit: string
  data: Array<{ name: string; value: number | null; isSite: boolean }>
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${v}${unit}`, title]}
                labelClassName="font-medium"
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={cwvColor(metric, entry.value)} opacity={entry.isSite ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function CompetitorsClient({ siteId }: { siteId: string }) {
  const [data, setData] = useState<CompetitorsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [overlapCompetitorId, setOverlapCompetitorId] = useState<string | null>(null)
  const [overlapData, setOverlapData] = useState<KeywordOverlapData | null>(null)
  const [overlapLoading, setOverlapLoading] = useState(false)
  const [overlapTab, setOverlapTab] = useState<OverlapTab>('shared')

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch(`/api/sites/${siteId}/competitors`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(setData)
      .catch(() => toast('error', 'Kunne ikke hente konkurrenter'))
      .finally(() => setLoading(false))
  }, [siteId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fejl' }))
        throw new Error(err.error || 'Kunne ikke tilføje')
      }
      setName(''); setUrl(''); setShowForm(false)
      toast('success', 'Konkurrent tilføjet')
      fetchData()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Kunne ikke tilføje konkurrent')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (competitorId: string) => {
    setDeleting(competitorId)
    try {
      const res = await fetch(`/api/sites/${siteId}/competitors/${competitorId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('success', 'Konkurrent fjernet')
      fetchData()
    } catch {
      toast('error', 'Kunne ikke fjerne konkurrent')
    } finally {
      setDeleting(null)
    }
  }

  const handleTest = async (competitorId: string) => {
    setTesting(competitorId)
    try {
      const res = await fetch(`/api/sites/${siteId}/competitors/${competitorId}/test`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fejl' }))
        throw new Error(err.error || 'Test fejlede')
      }
      toast('success', 'PSI-test fuldført')
      fetchData()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'PSI-test fejlede')
    } finally {
      setTesting(null)
    }
  }

  const handleOverlap = async (competitorId: string) => {
    if (overlapCompetitorId === competitorId) {
      setOverlapCompetitorId(null)
      setOverlapData(null)
      return
    }
    setOverlapCompetitorId(competitorId)
    setOverlapLoading(true)
    setOverlapTab('shared')
    try {
      const res = await fetch(`/api/sites/${siteId}/competitors/${competitorId}/keywords`)
      if (!res.ok) throw new Error()
      setOverlapData(await res.json())
    } catch {
      toast('error', 'Kunne ikke hente keyword-overlap')
      setOverlapCompetitorId(null)
    } finally {
      setOverlapLoading(false)
    }
  }

  // Build chart data
  function buildChartData(metric: 'perfScore' | 'lcpMs' | 'inpMs' | 'cls') {
    if (!data) return []
    const items: Array<{ name: string; value: number | null; isSite: boolean }> = []
    items.push({
      name: data.site.domain,
      value: data.site.latestPerf?.[metric] ?? null,
      isSite: true,
    })
    data.competitors.forEach(c => {
      items.push({
        name: c.name,
        value: c.latestSnapshot?.[metric] ?? null,
        isSite: false,
      })
    })
    return items.filter(i => i.value != null)
  }

  return (
    <div className="space-y-6">
      <SiteNav siteId={siteId} active="competitors" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Konkurrenter</h1>
          <p className="text-sm text-muted-foreground">Sammenlign performance med konkurrenter</p>
        </div>
        {data && data.competitors.length < data.maxCompetitors && (
          <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Tilføj konkurrent
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tilføj konkurrent</CardTitle>
            <CardDescription>Maks {data?.maxCompetitors ?? 5} konkurrenter per site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="comp-name">Navn</Label>
              <Input id="comp-name" placeholder="F.eks. Konkurrent A" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="comp-url">URL</Label>
              <Input id="comp-url" type="url" placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving || !name.trim() || !url.trim()} size="sm">
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Tilføj
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Annuller</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
          </div>
        </div>
      ) : !data || data.competitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Ingen konkurrenter tilføjet endnu.</p>
            <p className="text-sm text-muted-foreground mt-1">Tilføj op til {data?.maxCompetitors ?? 5} konkurrenter for at sammenligne performance.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Competitor table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Konkurrenter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Navn</th>
                      <th className="pb-2 font-medium">Score</th>
                      <th className="pb-2 font-medium">LCP</th>
                      <th className="pb-2 font-medium">INP</th>
                      <th className="pb-2 font-medium">CLS</th>
                      <th className="pb-2 font-medium">Seneste test</th>
                      <th className="pb-2 font-medium sr-only">Handlinger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Site's own row */}
                    <tr className="border-b bg-accent/30">
                      <td className="py-3 font-medium">{data.site.domain} (dit site)</td>
                      <td className="py-3">
                        <span style={{ color: cwvColor('score', data.site.latestPerf?.perfScore ?? null) }}>
                          {data.site.latestPerf?.perfScore ?? '—'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span style={{ color: cwvColor('lcp', data.site.latestPerf?.lcpMs ?? null) }}>
                          {data.site.latestPerf?.lcpMs != null ? `${(data.site.latestPerf.lcpMs / 1000).toFixed(1)}s` : '—'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span style={{ color: cwvColor('inp', data.site.latestPerf?.inpMs ?? null) }}>
                          {data.site.latestPerf?.inpMs != null ? `${data.site.latestPerf.inpMs}ms` : '—'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span style={{ color: cwvColor('cls', data.site.latestPerf?.cls ?? null) }}>
                          {data.site.latestPerf?.cls != null ? data.site.latestPerf.cls.toFixed(3) : '—'}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{data.site.latestPerf?.date ?? '—'}</td>
                      <td className="py-3" />
                    </tr>
                    {/* Competitor rows */}
                    {data.competitors.map(c => (
                      <tr key={c.id} className="border-b">
                        <td className="py-3">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-48">{c.url}</div>
                        </td>
                        <td className="py-3">
                          <span style={{ color: cwvColor('score', c.latestSnapshot?.perfScore ?? null) }}>
                            {c.latestSnapshot?.perfScore ?? '—'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span style={{ color: cwvColor('lcp', c.latestSnapshot?.lcpMs ?? null) }}>
                            {c.latestSnapshot?.lcpMs != null ? `${(c.latestSnapshot.lcpMs / 1000).toFixed(1)}s` : '—'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span style={{ color: cwvColor('inp', c.latestSnapshot?.inpMs ?? null) }}>
                            {c.latestSnapshot?.inpMs != null ? `${c.latestSnapshot.inpMs}ms` : '—'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span style={{ color: cwvColor('cls', c.latestSnapshot?.cls ?? null) }}>
                            {c.latestSnapshot?.cls != null ? c.latestSnapshot.cls.toFixed(3) : '—'}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">{c.latestSnapshot?.date ?? '—'}</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button
                              variant={overlapCompetitorId === c.id ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => handleOverlap(c.id)}
                              title="Keyword overlap"
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTest(c.id)}
                              disabled={testing === c.id}
                              title="Kør PSI-test"
                            >
                              {testing === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(c.id)}
                              disabled={deleting === c.id}
                              className="text-destructive hover:text-destructive"
                              title="Fjern konkurrent"
                            >
                              {deleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Keyword Overlap Section */}
          {overlapCompetitorId && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Keyword overlap: {overlapData?.competitorName ?? '...'}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { setOverlapCompetitorId(null); setOverlapData(null) }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {overlapLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 rounded" />
                    <Skeleton className="h-48 rounded" />
                  </div>
                ) : !overlapData ? null : !overlapData.available ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>{overlapData.message}</p>
                    <p className="text-xs mt-1">Tilføj konkurrentens domæne som et site i Glimpse for at aktivere keyword-overlap.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded border p-3 text-center">
                        <div className="text-2xl font-semibold">{overlapData.summary!.sharedCount}</div>
                        <div className="text-xs text-muted-foreground">Fælles keywords</div>
                      </div>
                      <div className="rounded border p-3 text-center">
                        <div className="text-2xl font-semibold">{overlapData.summary!.onlySourceCount}</div>
                        <div className="text-xs text-muted-foreground">Kun dit site</div>
                      </div>
                      <div className="rounded border p-3 text-center">
                        <div className="text-2xl font-semibold">{overlapData.summary!.onlyCompetitorCount}</div>
                        <div className="text-xs text-muted-foreground">Kun konkurrenten</div>
                      </div>
                      <div className="rounded border p-3 text-center">
                        <div className="text-2xl font-semibold">
                          <span className="text-emerald-600">{overlapData.summary!.winCount}</span>
                          {' / '}
                          <span className="text-red-600">{overlapData.summary!.loseCount}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Vinder / Taber</div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1">
                      {([
                        ['shared', `Fælles (${overlapData.summary!.sharedCount})`],
                        ['onlySource', `Kun dit site (${overlapData.summary!.onlySourceCount})`],
                        ['onlyCompetitor', `Kun konkurrenten (${overlapData.summary!.onlyCompetitorCount})`],
                      ] as [OverlapTab, string][]).map(([tab, label]) => (
                        <button
                          key={tab}
                          onClick={() => setOverlapTab(tab)}
                          className={`px-3 py-1.5 rounded text-sm ${overlapTab === tab ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Shared keywords table */}
                    {overlapTab === 'shared' && (
                      overlapData.shared!.length === 0 ? (
                        <p className="py-4 text-center text-muted-foreground">Ingen fælles keywords fundet.</p>
                      ) : (
                        <div className="max-h-96 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Keyword</TableHead>
                                <TableHead>Din pos.</TableHead>
                                <TableHead>Konk. pos.</TableHead>
                                <TableHead>Forskel</TableHead>
                                <TableHead>Dine klik</TableHead>
                                <TableHead>Konk. klik</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {overlapData.shared!.slice(0, 100).map(k => (
                                <TableRow key={k.query}>
                                  <TableCell className="font-medium max-w-48 truncate">{k.query}</TableCell>
                                  <TableCell>{k.sourcePosition.toFixed(1)}</TableCell>
                                  <TableCell>{k.competitorPosition.toFixed(1)}</TableCell>
                                  <TableCell>
                                    {k.positionGap > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-emerald-600">
                                        <ArrowUp className="h-3 w-3" /> +{k.positionGap.toFixed(1)}
                                      </span>
                                    ) : k.positionGap < 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-red-600">
                                        <ArrowDown className="h-3 w-3" /> {k.positionGap.toFixed(1)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">0</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{k.sourceClicks.toLocaleString()}</TableCell>
                                  <TableCell>{k.competitorClicks.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    )}

                    {/* Only source keywords table */}
                    {overlapTab === 'onlySource' && (
                      overlapData.onlySource!.length === 0 ? (
                        <p className="py-4 text-center text-muted-foreground">Ingen unikke keywords fundet for dit site.</p>
                      ) : (
                        <div className="max-h-96 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Keyword</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Klik</TableHead>
                                <TableHead>Visninger</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {overlapData.onlySource!.slice(0, 100).map(k => (
                                <TableRow key={k.query}>
                                  <TableCell className="font-medium max-w-48 truncate">{k.query}</TableCell>
                                  <TableCell>{k.position.toFixed(1)}</TableCell>
                                  <TableCell>{k.clicks.toLocaleString()}</TableCell>
                                  <TableCell>{k.impressions.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    )}

                    {/* Only competitor keywords table */}
                    {overlapTab === 'onlyCompetitor' && (
                      overlapData.onlyCompetitor!.length === 0 ? (
                        <p className="py-4 text-center text-muted-foreground">Ingen unikke keywords fundet for konkurrenten.</p>
                      ) : (
                        <div className="max-h-96 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Keyword</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Klik</TableHead>
                                <TableHead>Visninger</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {overlapData.onlyCompetitor!.slice(0, 100).map(k => (
                                <TableRow key={k.query}>
                                  <TableCell className="font-medium max-w-48 truncate">{k.query}</TableCell>
                                  <TableCell>{k.position.toFixed(1)}</TableCell>
                                  <TableCell>{k.clicks.toLocaleString()}</TableCell>
                                  <TableCell>{k.impressions.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricChart title="Performance Score" metric="score" unit="" data={buildChartData('perfScore')} />
            <MetricChart title="LCP (ms)" metric="lcp" unit="ms" data={buildChartData('lcpMs')} />
            <MetricChart title="INP (ms)" metric="inp" unit="ms" data={buildChartData('inpMs')} />
            <MetricChart title="CLS" metric="cls" unit="" data={buildChartData('cls')} />
          </div>
        </>
      )}
    </div>
  )
}
