import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { parseParams, ctr, safePctDelta, positionImprovementPct } from '@/lib/gsc/params'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const { days, page, pageSize, device, country, sortField, sortDir, search, positionFilter } = parseParams(searchParams)

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1)

  const deviceFilter = device === 'all' ? '' : device
  const countryFilter = country === 'ALL' ? '' : country

  // Build WHERE clause fragments (use actual DB column names from @map)
  const whereParts: string[] = [`"site_id" = $1`, `"date" >= $2`, `"date" <= $3`]
  const baseParams: (string | Date)[] = [site.id, start, end]

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

  const baseWhere = whereParts.join(' AND ')

  // HAVING clause for position filter
  const havingMap: Record<string, string> = {
    top3: 'HAVING AVG("position") <= 3',
    top10: 'HAVING AVG("position") <= 10',
    top20: 'HAVING AVG("position") <= 20',
    '50plus': 'HAVING AVG("position") > 50',
  }
  const havingClause = havingMap[positionFilter] || ''

  // Total count uses subquery to support HAVING
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM (
       SELECT "query" FROM "search_stat_daily" WHERE ${baseWhere} GROUP BY "query" ${havingClause}
     ) sub`,
    ...baseParams,
  )
  const totalItems = Number(countResult[0]?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Map sort field to SQL ORDER BY
  const orderByMap: Record<string, string> = {
    clicks: 'SUM("clicks")',
    impressions: 'SUM("impressions")',
    position: 'AVG("position")',
    ctr: 'CASE WHEN SUM("impressions") > 0 THEN SUM("clicks")::float / SUM("impressions") ELSE 0 END',
  }
  const orderExpr = orderByMap[sortField] || orderByMap.clicks
  const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC'
  const offset = (page - 1) * pageSize

  // Paginated grouped query with server-side sort
  const nextParam = baseParams.length + 1
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
     LIMIT $${nextParam} OFFSET $${nextParam + 1}`,
    ...baseParams, pageSize, offset,
  )

  // Fetch prev data only for the keywords on this page
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

  const items = rows.map(r => {
    const clicks = Number(r.clicks)
    const impressions = Number(r.impressions)
    const position = Number(r.position) || 0

    const prev = prevMap.get(r.query)
    let pClicks = prev?.clicks ?? 0
    let pImpr = prev?.impressions ?? 0
    let pPos = prev?.position ?? 0

    if (process.env.MOCK_GSC === 'true' && pClicks === 0 && pImpr === 0 && pPos === 0) {
      pClicks = Math.max(0, Math.round(clicks * 0.8))
      pImpr = Math.max(0, Math.round(impressions * 0.9))
      pPos = position * 1.1
    }

    const currCtr = ctr(clicks, impressions)
    const prevCtr = ctr(pClicks, pImpr)

    return {
      key: r.query,
      query: r.query,
      clicks30: clicks,
      impressions30: impressions,
      ctr30: currCtr,
      position30: position,
      trendClicks: safePctDelta(clicks, pClicks),
      trendImpressions: safePctDelta(impressions, pImpr),
      trendCtr: safePctDelta(currCtr, prevCtr),
      trendPosition: positionImprovementPct(position, pPos),
    }
  })

  return NextResponse.json({ items, page, pageSize, totalItems, totalPages, sortField, sortDir })
}
