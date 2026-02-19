import { prisma } from '@/lib/db'

/** Expected organic CTR by position range (industry averages) */
const EXPECTED_CTR_BY_POSITION: Record<string, number> = {
  '1': 28.5,
  '2': 15.7,
  '3': 11.0,
  '4': 8.0,
  '5': 7.2,
  '6': 5.1,
  '7': 4.0,
  '8': 3.2,
  '9': 2.8,
  '10': 2.5,
  '11-15': 1.5,
  '16-20': 0.8,
}

function getExpectedCtr(position: number): number {
  const rounded = Math.round(position)
  if (rounded >= 1 && rounded <= 10) return EXPECTED_CTR_BY_POSITION[String(rounded)] ?? 1.0
  if (rounded >= 11 && rounded <= 15) return EXPECTED_CTR_BY_POSITION['11-15'] ?? 1.5
  if (rounded >= 16 && rounded <= 20) return EXPECTED_CTR_BY_POSITION['16-20'] ?? 0.8
  return 0.5
}

function getExpectedCtrAtPosition(position: number): number {
  return getExpectedCtr(Math.max(1, position))
}

export interface KeywordOpportunity {
  keyword: string
  position: number
  impressions: number
  clicks: number
  currentCtr: number
  expectedCtr: number
  improvedPosition: number
  improvedCtr: number
  potentialExtraClicks: number
}

export async function findKeywordOpportunities(siteId: string, days = 30): Promise<KeywordOpportunity[]> {
  const now = new Date()
  const daysAgo = new Date()
  daysAgo.setDate(now.getDate() - days)

  // Aggregate keywords: impressions > 50, position 4-20
  const keywords = await prisma.searchStatDaily.groupBy({
    by: ['query'],
    where: {
      siteId,
      date: { gte: daysAgo, lte: now },
    },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true, ctr: true },
    having: {
      impressions: { _sum: { gt: 50 } },
      position: { _avg: { gte: 4, lte: 20 } },
    },
    orderBy: { _sum: { impressions: 'desc' } },
    take: 100,
  })

  const opportunities: KeywordOpportunity[] = []

  for (const kw of keywords) {
    const position = kw._avg.position ?? 0
    const impressions = kw._sum.impressions ?? 0
    const clicks = kw._sum.clicks ?? 0
    const currentCtr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const expectedCtr = getExpectedCtr(position)

    // Only include if CTR is below expected for position
    if (currentCtr >= expectedCtr) continue

    const improvedPosition = Math.max(1, position - 3)
    const improvedCtr = getExpectedCtrAtPosition(improvedPosition)
    const potentialExtraClicks = Math.round((improvedCtr - currentCtr) / 100 * impressions)

    if (potentialExtraClicks <= 0) continue

    opportunities.push({
      keyword: kw.query,
      position: Math.round(position * 10) / 10,
      impressions,
      clicks,
      currentCtr: Math.round(currentCtr * 100) / 100,
      expectedCtr: Math.round(expectedCtr * 100) / 100,
      improvedPosition: Math.round(improvedPosition * 10) / 10,
      improvedCtr: Math.round(improvedCtr * 100) / 100,
      potentialExtraClicks,
    })
  }

  // Sort by potential extra clicks descending
  opportunities.sort((a, b) => b.potentialExtraClicks - a.potentialExtraClicks)

  return opportunities.slice(0, 20)
}
