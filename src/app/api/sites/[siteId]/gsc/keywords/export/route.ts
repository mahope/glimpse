import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { parseParams, ctr, safePctDelta, positionImprovementPct } from '@/lib/gsc/params'
import { toCsv, csvResponse } from '@/lib/csv'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const { days, device, country, sortField, sortDir, search, positionFilter } = parseParams(searchParams)
  const tagIdRaw = searchParams.get('tagId') || ''
  const tagId = tagIdRaw.length <= 30 ? tagIdRaw : ''

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1)

  const deviceFilter = device === 'all' ? '' : device
  const countryFilter = country === 'ALL' ? '' : country

  const whereParts: string[] = [`"site_id" = $1`, `"date" >= $2`, `"date" <= $3`]
  const baseParams: (string | Date | string[])[] = [site.id, start, end]

  if (deviceFilter) {
    baseParams.push(deviceFilter)
    whereParts.push(`"device" = $${baseParams.length}`)
  }
  if (countryFilter) {
    baseParams.push(countryFilter)
    whereParts.push(`"country" = $${baseParams.length}`)
  }
  if (search) {
    baseParams.push(`%${search}%`)
    whereParts.push(`"query" ILIKE $${baseParams.length}`)
  }

  if (tagId) {
    const taggedKeywords = await prisma.keywordTagAssignment.findMany({
      where: { tagId, siteId: site.id },
      select: { query: true },
    })
    const taggedQueries = taggedKeywords.map(t => t.query)
    if (taggedQueries.length === 0) {
      return csvResponse(toCsv([], []), `${site.domain}-keywords-${new Date().toISOString().split('T')[0]}.csv`)
    }
    baseParams.push(taggedQueries)
    whereParts.push(`"query" = ANY($${baseParams.length}::text[])`)
  }

  const baseWhere = whereParts.join(' AND ')

  const havingMap: Record<string, string> = {
    top3: 'HAVING AVG("position") <= 3',
    top10: 'HAVING AVG("position") <= 10',
    top20: 'HAVING AVG("position") <= 20',
    '50plus': 'HAVING AVG("position") > 50',
  }
  const havingClause = havingMap[positionFilter] || ''

  const orderByMap: Record<string, string> = {
    clicks: 'SUM("clicks")',
    impressions: 'SUM("impressions")',
    position: 'AVG("position")',
    ctr: 'CASE WHEN SUM("impressions") > 0 THEN SUM("clicks")::float / SUM("impressions") ELSE 0 END',
  }
  const orderExpr = orderByMap[sortField] || orderByMap.clicks
  const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC'

  // Fetch ALL rows (no pagination limit for export)
  const rows = await prisma.$queryRawUnsafe<Array<{
    query: string
    clicks: bigint
    impressions: bigint
    position: number
  }>>(
    `SELECT "query", SUM("clicks") as clicks, SUM("impressions") as impressions, AVG("position")::float8 as position
     FROM "search_stat_daily"
     WHERE ${baseWhere}
     GROUP BY "query"
     ${havingClause}
     ORDER BY ${orderExpr} ${orderDir}, "query" ASC
     LIMIT 10000`,
    ...baseParams,
  )

  // Fetch prev data for all keywords
  const keywords = rows.map(r => r.query)
  let prevMap = new Map<string, { clicks: number; impressions: number; position: number }>()
  if (keywords.length > 0) {
    const prevRows = await prisma.searchStatDaily.groupBy({
      by: ['query'],
      where: {
        siteId: site.id,
        date: { gte: prevStart, lte: prevEnd },
        query: { in: keywords },
        ...(deviceFilter ? { device: deviceFilter } : {}),
        ...(countryFilter ? { country: countryFilter } : {}),
      },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    })
    prevMap = new Map(prevRows.map(r => [r.query!, {
      clicks: r._sum.clicks ?? 0,
      impressions: r._sum.impressions ?? 0,
      position: r._avg.position ?? 0,
    }]))
  }

  const csvHeaders = ['Keyword', 'Clicks', 'Impressions', 'CTR (%)', 'Avg Position', 'Clicks Trend (%)', 'Impressions Trend (%)', 'CTR Trend (%)', 'Position Trend (%)']
  const csvRows = rows.map(r => {
    const clicks = Number(r.clicks)
    const impressions = Number(r.impressions)
    const position = Number(r.position) || 0
    const prev = prevMap.get(r.query)
    const pClicks = prev?.clicks ?? 0
    const pImpr = prev?.impressions ?? 0
    const pPos = prev?.position ?? 0
    const currCtr = ctr(clicks, impressions)
    const prevCtr = ctr(pClicks, pImpr)

    return [
      r.query,
      clicks,
      impressions,
      currCtr.toFixed(1),
      position.toFixed(1),
      safePctDelta(clicks, pClicks).toFixed(1),
      safePctDelta(impressions, pImpr).toFixed(1),
      safePctDelta(currCtr, prevCtr).toFixed(1),
      positionImprovementPct(position, pPos).toFixed(1),
    ]
  })

  const date = new Date().toISOString().split('T')[0]
  const filename = `${site.domain}-keywords-${date}.csv`
  return csvResponse(toCsv(csvHeaders, csvRows), filename)
}
