import { prisma } from '@/lib/db'

export interface KeywordMetrics {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface OverlapKeyword {
  query: string
  sourceClicks: number
  sourceImpressions: number
  sourcePosition: number
  competitorClicks: number
  competitorImpressions: number
  competitorPosition: number
  positionGap: number // positive = you rank better (lower position)
}

export interface KeywordOverlapResult {
  shared: OverlapKeyword[]
  onlySource: KeywordMetrics[]
  onlyCompetitor: KeywordMetrics[]
  summary: {
    sharedCount: number
    onlySourceCount: number
    onlyCompetitorCount: number
    avgPositionGap: number
    winCount: number
    loseCount: number
  }
}

interface AggRow {
  query: string
  clicks: number
  impressions: number
  position: number
}

async function getKeywordsForSite(siteId: string, start: Date, end: Date): Promise<Map<string, AggRow>> {
  const rows = await prisma.$queryRawUnsafe<AggRow[]>(
    `SELECT
       "query",
       SUM("clicks")::int as clicks,
       SUM("impressions")::int as impressions,
       AVG("position")::float8 as position
     FROM "search_stat_daily"
     WHERE "site_id" = $1 AND "date" >= $2 AND "date" <= $3
     GROUP BY "query"
     HAVING SUM("impressions") > 0`,
    siteId, start, end,
  )
  const map = new Map<string, AggRow>()
  for (const r of rows) {
    map.set(r.query, r)
  }
  return map
}

export async function analyzeKeywordOverlap(
  sourceSiteId: string,
  competitorSiteId: string,
  days: number = 30,
): Promise<KeywordOverlapResult> {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)

  const [sourceMap, compMap] = await Promise.all([
    getKeywordsForSite(sourceSiteId, start, end),
    getKeywordsForSite(competitorSiteId, start, end),
  ])

  const shared: OverlapKeyword[] = []
  const onlySource: KeywordMetrics[] = []
  const onlyCompetitor: KeywordMetrics[] = []

  // Find shared and source-only
  for (const [query, src] of sourceMap) {
    const comp = compMap.get(query)
    if (comp) {
      shared.push({
        query,
        sourceClicks: src.clicks,
        sourceImpressions: src.impressions,
        sourcePosition: src.position,
        competitorClicks: comp.clicks,
        competitorImpressions: comp.impressions,
        competitorPosition: comp.position,
        positionGap: comp.position - src.position, // positive = you rank better
      })
    } else {
      onlySource.push({
        query,
        clicks: src.clicks,
        impressions: src.impressions,
        ctr: src.impressions > 0 ? src.clicks / src.impressions : 0,
        position: src.position,
      })
    }
  }

  // Find competitor-only
  for (const [query, comp] of compMap) {
    if (!sourceMap.has(query)) {
      onlyCompetitor.push({
        query,
        clicks: comp.clicks,
        impressions: comp.impressions,
        ctr: comp.impressions > 0 ? comp.clicks / comp.impressions : 0,
        position: comp.position,
      })
    }
  }

  // Sort: shared by absolute position gap desc, unique by clicks desc
  shared.sort((a, b) => Math.abs(b.positionGap) - Math.abs(a.positionGap))
  onlySource.sort((a, b) => b.clicks - a.clicks)
  onlyCompetitor.sort((a, b) => b.clicks - a.clicks)

  const winCount = shared.filter(k => k.positionGap > 0).length
  const loseCount = shared.filter(k => k.positionGap < 0).length
  const avgGap = shared.length > 0
    ? shared.reduce((sum, k) => sum + k.positionGap, 0) / shared.length
    : 0

  return {
    shared,
    onlySource,
    onlyCompetitor,
    summary: {
      sharedCount: shared.length,
      onlySourceCount: onlySource.length,
      onlyCompetitorCount: onlyCompetitor.length,
      avgPositionGap: Math.round(avgGap * 10) / 10,
      winCount,
      loseCount,
    },
  }
}
