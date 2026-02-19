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
  const { days, from, to, page, pageSize, device, country, sortField, sortDir, search } = parseParams(searchParams)
  const pathPrefix = searchParams.get('pathPrefix') || ''

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const end = from && to ? new Date(to + 'T23:59:59') : new Date()
  const start = from && to ? new Date(from + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate() - days); return d })()
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
    whereParts.push(`"page_url" ILIKE $${baseParams.length}`)
  }
  if (pathPrefix) {
    // Match URLs whose path starts with the prefix (e.g. /blog/ matches https://example.com/blog/*)
    const escaped = pathPrefix.replace(/[%_\\]/g, '\\$&')
    baseParams.push(escaped + '%')
    whereParts.push(`substring("page_url" from '^https?://[^/]+(/.*)$') LIKE $${baseParams.length} ESCAPE '\\'`)
  }

  const baseWhere = whereParts.join(' AND ')
  const groupByPath = searchParams.get('groupBy') === 'path'

  // Server-side path grouping: aggregate by first URL path segment
  if (groupByPath) {
    const groupRows = await prisma.$queryRawUnsafe<Array<{
      path: string
      page_count: bigint
      total_clicks: bigint
      total_impressions: bigint
      avg_position: number
    }>>(
      `SELECT
         COALESCE('/' || split_part(substring("page_url" from '^https?://[^/]+/([^/?#]+)'), '/', 1) || '/', '/') as path,
         COUNT(DISTINCT "page_url") as page_count,
         SUM("clicks") as total_clicks,
         SUM("impressions") as total_impressions,
         AVG("position")::float8 as avg_position
       FROM "search_stat_daily"
       WHERE ${baseWhere}
       GROUP BY 1
       ORDER BY total_clicks DESC`,
      ...baseParams,
    )
    const groups = groupRows.map(r => ({
      path: r.path,
      pageCount: Number(r.page_count),
      totalClicks: Number(r.total_clicks),
      totalImpressions: Number(r.total_impressions),
      avgPosition: Number(r.avg_position) || 0,
    }))
    return NextResponse.json({ groups })
  }

  // Total count via COUNT(DISTINCT page_url)
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(DISTINCT "page_url") as count FROM "search_stat_daily" WHERE ${baseWhere}`,
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
    page_url: string
    clicks: bigint
    impressions: bigint
    position: number
  }>>(
    `SELECT "page_url", SUM("clicks") as clicks, SUM("impressions") as impressions, AVG("position")::float8 as position
     FROM "search_stat_daily"
     WHERE ${baseWhere}
     GROUP BY "page_url"
     ORDER BY ${orderExpr} ${orderDir}, "page_url" ASC
     LIMIT $${nextParam} OFFSET $${nextParam + 1}`,
    ...baseParams, pageSize, offset,
  )

  // Fetch prev data only for the pages on this page
  const pageUrls = rows.map(r => r.page_url)
  let prevMap = new Map<string, { clicks: number; impressions: number; position: number }>()
  if (pageUrls.length > 0) {
    const prevRows = await prisma.searchStatDaily.groupBy({
      by: ['pageUrl'],
      where: {
        siteId: site.id,
        date: { gte: prevStart, lte: prevEnd },
        pageUrl: { in: pageUrls },
        ...(deviceFilter ? { device: deviceFilter } : {}),
        ...(countryFilter ? { country: countryFilter } : {}),
      },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    })
    prevMap = new Map(prevRows.map(r => [r.pageUrl!, {
      clicks: r._sum.clicks ?? 0,
      impressions: r._sum.impressions ?? 0,
      position: r._avg.position ?? 0,
    }]))
  }

  const items = rows.map(r => {
    const clicks = Number(r.clicks)
    const impressions = Number(r.impressions)
    const position = Number(r.position) || 0

    const prev = prevMap.get(r.page_url)
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
      key: r.page_url,
      pageUrl: r.page_url,
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
