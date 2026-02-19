import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { findMatchedSite } from '@/lib/competitors/match-site'

interface DailyPosition {
  date: string
  position: number
}

export async function GET(req: NextRequest, { params }: { params: { siteId: string; competitorId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const competitor = await prisma.competitor.findFirst({
    where: { id: params.competitorId, siteId: site.id },
  })
  if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

  const matchedSite = await findMatchedSite(competitor.url, organizationId, site.id)

  if (!matchedSite) {
    return NextResponse.json({ available: false, message: 'Konkurrenten er ikke et site i Glimpse.' })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query')
  const days = Math.min(Math.max(Number(searchParams.get('days') || 90), 7), 365)

  if (!query || query.length > 500) {
    return NextResponse.json({ error: 'Invalid query parameter' }, { status: 400 })
  }

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)

  try {
    const [sourcePositions, competitorPositions] = await Promise.all([
      prisma.$queryRawUnsafe<DailyPosition[]>(
        `SELECT "date"::text as date, AVG("position")::float8 as position
         FROM "search_stat_daily"
         WHERE "site_id" = $1 AND "query" = $2 AND "date" >= $3 AND "date" <= $4
         GROUP BY "date" ORDER BY "date" ASC`,
        site.id, query, start, end,
      ),
      prisma.$queryRawUnsafe<DailyPosition[]>(
        `SELECT "date"::text as date, AVG("position")::float8 as position
         FROM "search_stat_daily"
         WHERE "site_id" = $1 AND "query" = $2 AND "date" >= $3 AND "date" <= $4
         GROUP BY "date" ORDER BY "date" ASC`,
        matchedSite.id, query, start, end,
      ),
    ])

    // Merge into a single timeline
    const dateMap = new Map<string, { date: string; sourcePosition: number | null; competitorPosition: number | null }>()

    for (const row of sourcePositions) {
      const d = row.date.split('T')[0]
      dateMap.set(d, { date: d, sourcePosition: row.position, competitorPosition: null })
    }
    for (const row of competitorPositions) {
      const d = row.date.split('T')[0]
      const existing = dateMap.get(d)
      if (existing) {
        existing.competitorPosition = row.position
      } else {
        dateMap.set(d, { date: d, sourcePosition: null, competitorPosition: row.position })
      }
    }

    const timeline = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      available: true,
      query,
      days,
      siteName: site.name,
      competitorName: competitor.name,
      timeline,
    })
  } catch (error) {
    console.error('Rank comparison failed:', error)
    return NextResponse.json({ error: 'Rank comparison failed' }, { status: 500 })
  }
}
