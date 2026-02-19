import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { safePctDelta } from '@/lib/gsc/params'

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const sites = await prisma.site.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, domain: true },
  })

  if (sites.length === 0) {
    return NextResponse.json({ sites: [] })
  }

  const siteIds = sites.map(s => s.id)
  const now = new Date()
  const d30Ago = new Date(); d30Ago.setDate(now.getDate() - 30)
  const d60Ago = new Date(); d60Ago.setDate(now.getDate() - 60)

  // Fetch all data in parallel
  const [perfRows, alertCounts, crawlReports, gscCurr, gscPrev] = await Promise.all([
    // Latest perf daily per site (prefer MOBILE, fallback to ALL)
    prisma.sitePerfDaily.findMany({
      where: { siteId: { in: siteIds }, device: { in: ['MOBILE', 'ALL'] } },
      orderBy: { date: 'desc' },
      distinct: ['siteId'],
      select: { siteId: true, perfScoreAvg: true, device: true },
    }),
    // Open alerts per site
    prisma.alertEvent.groupBy({
      by: ['siteId'],
      where: { siteId: { in: siteIds }, status: 'OPEN' },
      _count: true,
    }),
    // Latest crawl report per site
    prisma.crawlReport.findMany({
      where: { siteId: { in: siteIds } },
      orderBy: { startedAt: 'desc' },
      distinct: ['siteId'],
      select: { siteId: true, pagesCrawled: true, totals: true },
    }),
    // GSC aggregates: last 30 days per site
    prisma.searchStatDaily.groupBy({
      by: ['siteId'],
      where: { siteId: { in: siteIds }, date: { gte: d30Ago, lte: now } },
      _sum: { clicks: true, impressions: true },
    }),
    // GSC aggregates: previous 30 days per site
    prisma.searchStatDaily.groupBy({
      by: ['siteId'],
      where: { siteId: { in: siteIds }, date: { gte: d60Ago, lt: d30Ago } },
      _sum: { clicks: true, impressions: true },
    }),
  ])

  // Build lookup maps
  const perfMap = new Map(perfRows.map(r => [r.siteId, r.perfScoreAvg]))
  const alertMap = new Map(alertCounts.map(r => [r.siteId, r._count]))
  const crawlMap = new Map(crawlReports.map(r => [r.siteId, r]))
  const gscCurrMap = new Map(gscCurr.map(r => [r.siteId, r._sum]))
  const gscPrevMap = new Map(gscPrev.map(r => [r.siteId, r._sum]))

  const healthSites = sites.map(site => {
    // 1. PSI Performance Score (40%) — 0-100 from perfScoreAvg
    const psiScore = perfMap.get(site.id) ?? null
    const psiComponent = psiScore != null ? psiScore : 50 // neutral default

    // 2. Active Alerts Score (20%) — fewer alerts = higher score
    const openAlerts = alertMap.get(site.id) ?? 0
    // 0 alerts = 100, 1 = 80, 2 = 60, 3 = 40, 4 = 20, 5+ = 0
    const alertComponent = Math.max(0, 100 - openAlerts * 20)

    // 3. Crawl Issues Score (20%) — based on issue count relative to pages
    const crawl = crawlMap.get(site.id)
    let crawlComponent = 70 // neutral default if no crawl
    if (crawl) {
      const totals = crawl.totals as { errors?: number; warnings?: number; info?: number } | null
      const totalIssues = (totals?.errors ?? 0) + (totals?.warnings ?? 0)
      const pages = crawl.pagesCrawled || 1
      const issueRatio = totalIssues / pages
      // 0 issues = 100, ratio >= 2 = 0
      crawlComponent = Math.max(0, Math.round(100 - issueRatio * 50))
    }

    // 4. GSC Trend Score (20%) — click growth trend
    const currClicks = gscCurrMap.get(site.id)?.clicks ?? 0
    const prevClicks = gscPrevMap.get(site.id)?.clicks ?? 0
    const clickDelta = safePctDelta(currClicks, prevClicks)
    // Map delta to 0-100: +50% or more = 100, -50% or less = 0, 0% = 50
    const gscComponent = Math.max(0, Math.min(100, Math.round(50 + clickDelta)))

    // Weighted total
    const health = Math.round(
      psiComponent * 0.4 +
      alertComponent * 0.2 +
      crawlComponent * 0.2 +
      gscComponent * 0.2
    )

    return {
      id: site.id,
      name: site.name || site.domain,
      domain: site.domain,
      health,
      components: {
        psi: psiComponent,
        alerts: alertComponent,
        crawl: crawlComponent,
        gscTrend: gscComponent,
      },
      openAlerts,
      psiScore,
    }
  })

  // Sort worst first
  healthSites.sort((a, b) => a.health - b.health)

  return NextResponse.json({ sites: healthSites })
}
