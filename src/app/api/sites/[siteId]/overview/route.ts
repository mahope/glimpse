import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getCache, setCache } from '@/lib/cache'
import { safePctDelta } from '@/lib/gsc/params'

const CACHE_TTL = 3600 // 1 hour

type CompareMode = 'prev' | 'year' | 'none'

function yearAgo(d: Date): Date {
  const result = new Date(d)
  const originalMonth = result.getMonth()
  result.setFullYear(result.getFullYear() - 1)
  // Clamp if month rolled forward (e.g. Feb 29 -> Mar 1 in non-leap year)
  if (result.getMonth() !== originalMonth) {
    result.setDate(0) // last day of the previous month
  }
  return result
}

function computeComparisonRange(start: Date, end: Date, days: number, mode: CompareMode) {
  if (mode === 'year') {
    return { cStart: yearAgo(start), cEnd: yearAgo(end) }
  }
  // Default: previous period
  const cEnd = new Date(start)
  cEnd.setDate(cEnd.getDate() - 1)
  const cStart = new Date(cEnd)
  cStart.setDate(cStart.getDate() - days + 1)
  return { cStart, cEnd }
}

function toDateRow(r: { date: Date; _sum: { clicks: number | null; impressions: number | null }; _avg: { position: number | null } }) {
  const clicks = r._sum.clicks || 0
  const impressions = r._sum.impressions || 0
  return {
    date: r.date.toISOString().split('T')[0],
    clicks,
    impressions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    position: r._avg.position || 0,
  }
}

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 30), 1), 365)
  const device = String(searchParams.get('device') ?? 'all').toLowerCase()
  const country = String(searchParams.get('country') ?? 'ALL').toUpperCase()
  const compareRaw = String(searchParams.get('compare') ?? 'prev').toLowerCase()
  const compare: CompareMode = compareRaw === 'year' ? 'year' : compareRaw === 'none' ? 'none' : 'prev'

  // Try cache first
  const cacheKey = `overview:${site.id}:${days}:${device}:${country}:${compare}`
  const cached = await getCache<Record<string, unknown>>(cacheKey)
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'private, max-age=3600', 'X-Cache': 'HIT' },
    })
  }

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)
  const hasCompare = compare !== 'none'
  const { cStart, cEnd } = hasCompare
    ? computeComparisonRange(start, end, days, compare)
    : { cStart: start, cEnd: end } // unused placeholders

  const whereBase = { siteId: site.id, ...(device !== 'all' ? { device } : {}), ...(country !== 'ALL' ? { country } : {}) }

  // Run queries in parallel
  const [currAgg, compAgg, timelineRows, compTimelineRows] = await Promise.all([
    prisma.searchStatDaily.aggregate({
      where: { ...whereBase, date: { gte: start, lte: end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    hasCompare
      ? prisma.searchStatDaily.aggregate({
          where: { ...whereBase, date: { gte: cStart, lte: cEnd } },
          _sum: { clicks: true, impressions: true },
          _avg: { position: true },
        })
      : Promise.resolve(null),
    prisma.searchStatDaily.groupBy({
      by: ['date'],
      where: { ...whereBase, date: { gte: start, lte: end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { date: 'asc' },
    }),
    hasCompare
      ? prisma.searchStatDaily.groupBy({
          by: ['date'],
          where: { ...whereBase, date: { gte: cStart, lte: cEnd } },
          _sum: { clicks: true, impressions: true },
          _avg: { position: true },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const clicks = currAgg._sum.clicks || 0
  const impressions = currAgg._sum.impressions || 0
  const position = currAgg._avg.position || 0
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

  const compClicks = compAgg?._sum.clicks || 0
  const compImpr = compAgg?._sum.impressions || 0
  const compPos = compAgg?._avg.position || 0
  const compCtr = compImpr > 0 ? (compClicks / compImpr) * 100 : 0

  const timeline = timelineRows.map(toDateRow)
  const compareTimeline = compTimelineRows.map(toDateRow)

  const result = {
    range: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], days },
    compareRange: hasCompare ? {
      start: cStart.toISOString().split('T')[0],
      end: cEnd.toISOString().split('T')[0],
      mode: compare,
    } : null,
    kpis: {
      clicks: { value: clicks, deltaPct: hasCompare ? safePctDelta(clicks, compClicks) : 0, compareValue: compClicks },
      impressions: { value: impressions, deltaPct: hasCompare ? safePctDelta(impressions, compImpr) : 0, compareValue: compImpr },
      ctr: { value: ctr, deltaPct: hasCompare ? safePctDelta(ctr, compCtr) : 0, compareValue: compCtr },
      position: { value: position, deltaPct: hasCompare ? safePctDelta(position, compPos) : 0, compareValue: compPos },
    },
    timeline,
    compareTimeline,
  }

  // Store in cache (best-effort, non-blocking)
  void setCache(cacheKey, result, CACHE_TTL)

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=3600', 'X-Cache': 'MISS' },
  })
}
