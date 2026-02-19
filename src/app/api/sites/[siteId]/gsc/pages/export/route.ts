import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { parseParams, ctr, safePctDelta, positionImprovementPct } from '@/lib/gsc/params'
import { csvStreamResponse } from '@/lib/csv'

const BATCH_SIZE = 2000

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const { days, from, to, device, country, sortField, sortDir, search } = parseParams(searchParams)
  const pathPrefix = searchParams.get('pathPrefix') || ''

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const end = from && to ? new Date(to + 'T23:59:59') : new Date()
  const start = from && to ? new Date(from + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate() - days); return d })()
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1)

  const deviceFilter = device === 'all' ? '' : device
  const countryFilter = country === 'ALL' ? '' : country

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
    const escaped = pathPrefix.replace(/[%_\\]/g, '\\$&')
    baseParams.push(escaped + '%')
    whereParts.push(`substring("page_url" from '^https?://[^/]+(/.*)$') LIKE $${baseParams.length} ESCAPE '\\'`)
  }

  const baseWhere = whereParts.join(' AND ')

  const orderByMap: Record<string, string> = {
    clicks: 'SUM("clicks")',
    impressions: 'SUM("impressions")',
    position: 'AVG("position")',
    ctr: 'CASE WHEN SUM("impressions") > 0 THEN SUM("clicks")::float / SUM("impressions") ELSE 0 END',
  }
  const orderExpr = orderByMap[sortField] || orderByMap.clicks
  const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC'

  const csvHeaders = ['Page URL', 'Clicks', 'Impressions', 'CTR (%)', 'Avg Position', 'Clicks Trend (%)', 'Impressions Trend (%)', 'CTR Trend (%)', 'Position Trend (%)']

  const date = new Date().toISOString().split('T')[0]
  const filename = `${site.domain}-pages-${date}.csv`

  return csvStreamResponse(csvHeaders, () => {
    return (async function*() {
      let offset = 0
      let hasMore = true

      while (hasMore) {
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
           LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
          ...baseParams,
        )

        if (rows.length === 0) break
        hasMore = rows.length === BATCH_SIZE

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

        for (const r of rows) {
          const clicks = Number(r.clicks)
          const impressions = Number(r.impressions)
          const position = Number(r.position) || 0
          const prev = prevMap.get(r.page_url)
          const pClicks = prev?.clicks ?? 0
          const pImpr = prev?.impressions ?? 0
          const pPos = prev?.position ?? 0
          const currCtr = ctr(clicks, impressions)
          const prevCtr = ctr(pClicks, pImpr)

          yield [
            r.page_url,
            clicks,
            impressions,
            currCtr.toFixed(1),
            position.toFixed(1),
            safePctDelta(clicks, pClicks).toFixed(1),
            safePctDelta(impressions, pImpr).toFixed(1),
            safePctDelta(currCtr, prevCtr).toFixed(1),
            positionImprovementPct(position, pPos).toFixed(1),
          ]
        }

        offset += BATCH_SIZE
      }
    })()
  }, filename)
}
