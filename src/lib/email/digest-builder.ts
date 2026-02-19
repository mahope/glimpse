import { prisma } from '@/lib/db'
import { generateRecommendations } from '@/lib/recommendations/engine'

export interface SiteDigest {
  siteId: string
  siteName: string
  domain: string
  seoScore: number | null
  seoScoreChange: number | null
  topMovers: Array<{ keyword: string; positionChange: number; direction: 'up' | 'down' }>
  newAlertCount: number
  topRecommendation: string | null
}

export interface WeeklyDigest {
  organizationName: string
  sites: SiteDigest[]
  totalAlerts: number
  periodLabel: string
}

export async function buildWeeklyDigest(organizationId: string): Promise<WeeklyDigest> {
  const now = new Date()
  const d7Ago = new Date(); d7Ago.setDate(now.getDate() - 7)
  const d14Ago = new Date(); d14Ago.setDate(now.getDate() - 14)

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })

  const sites = await prisma.site.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, domain: true },
  })

  const siteDigests: SiteDigest[] = []
  let totalAlerts = 0

  for (const site of sites) {
    // SEO score: latest vs 7 days ago
    const [latestScore, prevScore] = await Promise.all([
      prisma.seoScore.findFirst({
        where: { siteId: site.id },
        orderBy: { date: 'desc' },
        select: { score: true },
      }),
      prisma.seoScore.findFirst({
        where: { siteId: site.id, date: { lt: d7Ago } },
        orderBy: { date: 'desc' },
        select: { score: true },
      }),
    ])

    const seoScore = latestScore?.score ?? null
    const seoScoreChange = seoScore != null && prevScore?.score != null
      ? Math.round(seoScore - prevScore.score)
      : null

    // Top keyword movers (past 7 days vs prior 7 days)
    const [kwCurr, kwPrev] = await Promise.all([
      prisma.searchStatDaily.groupBy({
        by: ['query'],
        where: { siteId: site.id, date: { gte: d7Ago, lte: now } },
        _avg: { position: true },
        _sum: { clicks: true },
        orderBy: { _sum: { clicks: 'desc' } },
        take: 30,
      }),
      prisma.searchStatDaily.groupBy({
        by: ['query'],
        where: { siteId: site.id, date: { gte: d14Ago, lt: d7Ago } },
        _avg: { position: true },
        orderBy: { _avg: { position: 'asc' } },
        take: 50,
      }),
    ])

    const prevMap = new Map(kwPrev.map(k => [k.query, k._avg.position ?? 0]))
    const movers: Array<{ keyword: string; positionChange: number; direction: 'up' | 'down' }> = []

    for (const kw of kwCurr) {
      const curr = kw._avg.position ?? 0
      const prev = prevMap.get(kw.query)
      if (!prev || prev === 0 || curr === 0) continue
      const change = prev - curr // positive = improved (position number decreased)
      if (Math.abs(change) >= 1) {
        movers.push({
          keyword: kw.query,
          positionChange: Math.round(change * 10) / 10,
          direction: change > 0 ? 'up' : 'down',
        })
      }
    }

    // Sort by absolute change, take top 3
    movers.sort((a, b) => Math.abs(b.positionChange) - Math.abs(a.positionChange))
    const topMovers = movers.slice(0, 3)

    // New alerts in past 7 days
    const newAlertCount = await prisma.alertEvent.count({
      where: { siteId: site.id, createdAt: { gte: d7Ago }, status: 'OPEN' },
    })
    totalAlerts += newAlertCount

    // Top recommendation
    let topRecommendation: string | null = null
    try {
      const recs = await generateRecommendations(site.id)
      if (recs.length > 0) topRecommendation = recs[0].title
    } catch { /* ignore recommendation failures */ }

    siteDigests.push({
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      seoScore,
      seoScoreChange,
      topMovers,
      newAlertCount,
      topRecommendation,
    })
  }

  const startStr = d7Ago.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  const endStr = now.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })

  return {
    organizationName: org?.name ?? 'Ukendt organisation',
    sites: siteDigests,
    totalAlerts,
    periodLabel: `${startStr} — ${endStr}`,
  }
}
