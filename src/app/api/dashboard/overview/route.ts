import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

function pctDelta(curr: number, prev: number) {
  if (!isFinite(curr)) curr = 0
  if (!isFinite(prev)) prev = 0
  if (prev === 0) return curr === 0 ? 0 : 100
  return ((curr - prev) / Math.abs(prev)) * 100
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const sites = await prisma.site.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  })
  const siteIds = sites.map(s => s.id)

  if (siteIds.length === 0) {
    return NextResponse.json({
      kpis: {
        clicks: { value: 0, deltaPct: 0 },
        impressions: { value: 0, deltaPct: 0 },
        ctr: { value: 0, deltaPct: 0 },
        position: { value: 0, deltaPct: 0 },
      },
      timeline: [],
      topKeywords: [],
      topPages: [],
      performance: null,
      siteCount: 0,
    })
  }

  const days = 30
  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1)

  const whereBase = { siteId: { in: siteIds } }

  // Aggregated KPIs across all sites
  const [currAgg, prevAgg, timelineRows, keywordRows, pageRows, perfDaily] = await Promise.all([
    prisma.searchStatDaily.aggregate({
      where: { ...whereBase, date: { gte: start, lte: end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    prisma.searchStatDaily.aggregate({
      where: { ...whereBase, date: { gte: prevStart, lte: prevEnd } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    prisma.searchStatDaily.groupBy({
      by: ['date'],
      where: { ...whereBase, date: { gte: start, lte: end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { date: 'asc' },
    }),
    prisma.searchStatDaily.groupBy({
      by: ['query'],
      where: { ...whereBase, date: { gte: start, lte: end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { _sum: { clicks: 'desc' } },
      take: 8,
    }),
    prisma.searchStatDaily.groupBy({
      by: ['pageUrl'],
      where: { ...whereBase, date: { gte: start, lte: end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { _sum: { clicks: 'desc' } },
      take: 6,
    }),
    prisma.sitePerfDaily.findMany({
      where: { siteId: { in: siteIds } },
      orderBy: { date: 'desc' },
      distinct: ['siteId'],
      include: { site: { select: { domain: true } } },
    }),
  ])

  const clicks = currAgg._sum.clicks ?? 0
  const impressions = currAgg._sum.impressions ?? 0
  const position = currAgg._avg.position ?? 0
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

  const pClicks = prevAgg._sum.clicks ?? 0
  const pImpr = prevAgg._sum.impressions ?? 0
  const pPos = prevAgg._avg.position ?? 0
  const pCtr = pImpr > 0 ? (pClicks / pImpr) * 100 : 0

  const kpis = {
    clicks: { value: clicks, deltaPct: pctDelta(clicks, pClicks) },
    impressions: { value: impressions, deltaPct: pctDelta(impressions, pImpr) },
    ctr: { value: ctr, deltaPct: pctDelta(ctr, pCtr) },
    position: { value: position, deltaPct: pctDelta(position, pPos) },
  }

  const timeline = timelineRows.map(r => ({
    date: r.date.toISOString().split('T')[0],
    clicks: r._sum.clicks ?? 0,
    impressions: r._sum.impressions ?? 0,
    position: r._avg.position ?? 0,
  }))

  const topKeywords = keywordRows.map(r => {
    const c = r._sum.clicks ?? 0
    const i = r._sum.impressions ?? 0
    return {
      query: r.query!,
      clicks: c,
      impressions: i,
      ctr: i > 0 ? (c / i) * 100 : 0,
      position: r._avg.position ?? 0,
    }
  })

  const topPages = pageRows.map(r => {
    const c = r._sum.clicks ?? 0
    const i = r._sum.impressions ?? 0
    return {
      pageUrl: r.pageUrl!,
      clicks: c,
      impressions: i,
      ctr: i > 0 ? (c / i) * 100 : 0,
      position: r._avg.position ?? 0,
    }
  })

  // Aggregate performance across all sites
  let performance = null
  if (perfDaily.length > 0) {
    const scores = perfDaily.filter(p => p.perfScoreAvg != null)
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((s, p) => s + (p.perfScoreAvg ?? 0), 0) / scores.length)
      : null
    const avgLcp = perfDaily.filter(p => p.lcpPctl != null)
    const avgInp = perfDaily.filter(p => p.inpPctl != null)
    const avgCls = perfDaily.filter(p => p.clsPctl != null)

    performance = {
      overallScore: avgScore,
      lcp: avgLcp.length > 0 ? Math.round(avgLcp.reduce((s, p) => s + (p.lcpPctl ?? 0), 0) / avgLcp.length) : null,
      inp: avgInp.length > 0 ? Math.round(avgInp.reduce((s, p) => s + (p.inpPctl ?? 0), 0) / avgInp.length) : null,
      cls: perfDaily.filter(p => p.clsPctl != null).length > 0
        ? Math.round(perfDaily.filter(p => p.clsPctl != null).reduce((s, p) => s + (p.clsPctl ?? 0), 0) / perfDaily.filter(p => p.clsPctl != null).length)
        : null,
      siteCount: perfDaily.length,
    }
  }

  return NextResponse.json({
    kpis,
    timeline,
    topKeywords,
    topPages,
    performance,
    siteCount: siteIds.length,
  })
}
