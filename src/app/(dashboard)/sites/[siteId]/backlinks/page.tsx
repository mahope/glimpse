'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { SiteNav } from '@/components/site/site-nav'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Link2, Globe, Plus } from 'lucide-react'

interface BacklinkTotals {
  totalLinks: number
  totalReferringDomains: number
  linksDelta: number
  domainsDelta: number
  newDomains: number
}

interface TimelinePoint {
  date: string
  totalLinks: number
  totalReferringDomains: number
}

interface ReferringDomain {
  domain: string
  linkCount: number
  firstSeen: string
  lastSeen: string
}

interface BacklinkData {
  totals: BacklinkTotals
  timeline: TimelinePoint[]
  referringDomains: ReferringDomain[]
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>
  const positive = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{value}
    </span>
  )
}

export default function BacklinksPage() {
  const params = useParams<{ siteId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const siteId = params.siteId

  const [data, setData] = useState<BacklinkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(Number(searchParams.get('days') || 30))

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sites/${siteId}/backlinks?days=${days}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente data')
    } finally {
      setLoading(false)
    }
  }, [siteId, days])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const sp = new URLSearchParams()
    sp.set('days', String(days))
    router.replace(`?${sp.toString()}`)
  }, [days, router])

  return (
    <div className="space-y-6">
      <SiteNav siteId={siteId} active="backlinks" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Backlinks</h1>
        <select className="border rounded px-2 py-1 text-sm bg-background" value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={30}>30 dage</option>
          <option value={90}>90 dage</option>
          <option value={365}>365 dage</option>
        </select>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded" />)}
          </div>
          <Skeleton className="h-64 rounded" />
          <Skeleton className="h-48 rounded" />
        </div>
      )}

      {error && <div className="py-4 text-center text-destructive">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" /> Totale links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.totals.totalLinks.toLocaleString()}</div>
                <DeltaBadge value={data.totals.linksDelta} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Referring domains
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.totals.totalReferringDomains.toLocaleString()}</div>
                <DeltaBadge value={data.totals.domainsDelta} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Nye domæner
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.totals.newDomains.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Seneste {days} dage</div>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          {data.timeline.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Referring domains over tid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.timeline}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })} />
                      <Line type="monotone" dataKey="totalReferringDomains" name="Referring domains" stroke="#3b82f6" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="totalLinks" name="Totale links" stroke="#10b981" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Referring Domains Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top referring domains</CardTitle>
            </CardHeader>
            <CardContent>
              {data.referringDomains.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Ingen referring domains fundet endnu. Data synkroniseres dagligt.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domæne</TableHead>
                      <TableHead>Links</TableHead>
                      <TableHead>Første set</TableHead>
                      <TableHead>Sidst set</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.referringDomains.map(rd => (
                      <TableRow key={rd.domain}>
                        <TableCell className="font-medium">{rd.domain}</TableCell>
                        <TableCell>{rd.linkCount}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(rd.firstSeen).toLocaleDateString('da-DK')}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(rd.lastSeen).toLocaleDateString('da-DK')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
