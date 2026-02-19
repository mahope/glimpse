import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { renderReportPDF } from '@/lib/reports/pdf-generator'
import { endOfDay, startOfDay, subDays, format } from 'date-fns'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/sites/[siteId]/report')

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  try {
  const siteId = params.siteId
  const to = endOfDay(new Date())
  const from = startOfDay(subDays(to, 30))
  const periodLabel = `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`

  const site = await prisma.site.findFirst({
    where: { id: siteId, organizationId },
    include: {
      organization: true,
      seoScores: { where: { date: { gte: from, lte: to } }, orderBy: { date: 'desc' }, take: 1 },
      perfSnapshots: { orderBy: { date: 'desc' }, take: 1 },
      searchStatsDaily: { where: { date: { gte: from, lte: to } }, orderBy: { date: 'desc' }, take: 300 },
      crawlResults: { orderBy: { crawlDate: 'desc' }, take: 1 },
    }
  })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const score = site.seoScores[0]?.score ?? undefined
  const perf = site.perfSnapshots[0]

  // Simple aggregates from GSC (last 30 days)
  const queries = site.searchStatsDaily.filter(r => !!r.query)
  const topKeywords = Object.values(
    queries.reduce((acc, r) => {
      const key = r.query || ''
      if (!acc[key]) acc[key] = { keyword: key, clicks: 0, impressions: 0, ctr: 0, position: 0, n: 0 }
      acc[key].clicks += r.clicks
      acc[key].impressions += r.impressions
      acc[key].ctr += r.ctr
      acc[key].position += r.position
      acc[key].n += 1
      return acc
    }, {} as Record<string, { keyword: string; clicks: number; impressions: number; ctr: number; position: number; n: number }>)
  )
    .map(k => ({ keyword: k.keyword, clicks: k.clicks, impressions: k.impressions, ctr: k.ctr / k.n, position: k.position / k.n }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)

  const totals = site.searchStatsDaily.reduce((acc, r) => {
    acc.clicks += r.clicks
    acc.impressions += r.impressions
    acc.ctr += r.ctr
    acc.position += r.position
    acc.n += 1
    return acc
  }, { clicks: 0, impressions: 0, ctr: 0, position: 0, n: 0 })

  const kpis = [
    { label: 'Clicks', value: totals.clicks },
    { label: 'Impressions', value: totals.impressions },
    { label: 'Avg. Position', value: totals.n ? (totals.position / totals.n).toFixed(1) : '-' },
    { label: 'CTR', value: totals.n ? `${((totals.ctr / totals.n) * 100).toFixed(1)}%` : '-' },
  ]

  const trendsMap = new Map<string, { date: string; clicks: number; impressions: number; position: number; ctr: number; n: number }>()
  site.searchStatsDaily.forEach(r => {
    const d = new Date(r.date)
    const key = format(d, 'yyyy-MM-dd')
    const it = trendsMap.get(key) || { date: key, clicks: 0, impressions: 0, position: 0, ctr: 0, n: 0 }
    it.clicks += r.clicks
    it.impressions += r.impressions
    it.position += r.position
    it.ctr += r.ctr
    it.n += 1
    trendsMap.set(key, it)
  })
  const trends = Array.from(trendsMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => ({ date: t.date, clicks: t.clicks, impressions: t.impressions, position: t.n ? t.position / t.n : 0, ctr: t.n ? t.ctr / t.n : 0 }))

  const data = {
    site: { id: site.id, name: site.name, domain: site.domain, url: site.url, organization: { name: site.organization.name, logo: site.organization.logo } },
    period: { from: from.toISOString(), to: to.toISOString(), label: periodLabel },
    generatedAt: new Date().toISOString(),
    seoScore: score,
    kpis,
    performance: perf ? {
      lcp: perf.lcpMs != null ? perf.lcpMs / 1000 : undefined,
      inp: perf.inpMs != null ? perf.inpMs : undefined,
      cls: perf.cls ?? undefined,
      ttfb: perf.ttfbMs != null ? perf.ttfbMs : undefined,
    } : undefined,
    topKeywords,
    issues: Array.isArray(site.crawlResults[0]?.issues) ? site.crawlResults[0].issues as any[] : undefined,
    trends,
  }

  // Return JSON if requested (for in-browser preview)
  const { searchParams: sp } = new URL(req.url)
  if (sp.get('format') === 'json') {
    return NextResponse.json(data)
  }

  const buffer = await renderReportPDF(data as any)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${site.domain}-latest.pdf"`
    }
  })
  } catch (err) {
    log.error({ err }, 'Report route error')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
