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
  const { days, page, pageSize, device, country, sortField, sortDir } = parseParams(searchParams)

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)
  const prevEnd = new Date(start); const prevStart = new Date(start); prevStart.setDate(prevEnd.getDate() - days)

  const whereBase = { siteId: site.id, ...(device === 'all' ? {} : { device }), ...(country === 'ALL' ? {} : { country }) }

  // mapping for orderBy
  const orderBy = (() => {
    if (sortField === 'position') return { _avg: { position: sortDir } as any }
    if (sortField === 'ctr') return { _sum: { clicks: sortDir, impressions: sortDir } as any } // CTR approximated by ordering on clicks/impr
    if (sortField === 'impressions') return { _sum: { impressions: sortDir } as any }
    return { _sum: { clicks: sortDir } as any }
  })()

  const rows = await prisma.searchStatDaily.groupBy({
    by: ['query'],
    where: { ...whereBase, date: { gte: start, lte: end } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  // totals
  const totalGroups = await prisma.searchStatDaily.groupBy({
    by: ['query'],
    where: { ...whereBase, date: { gte: start, lte: end } },
    _count: { query: true },
  })
  const totalItems = totalGroups.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // previous window aggregates for trends
  const prevRows = await prisma.searchStatDaily.groupBy({
    by: ['query'],
    where: { ...whereBase, date: { gte: prevStart, lte: prevEnd } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
  })
  const prevMap = new Map(prevRows.map(r => [r.query!, r]))

  const items = rows.map(r => {
    const clicks = r._sum.clicks || 0
    const impressions = r._sum.impressions || 0
    const position = r._avg.position || 0

    const prev = prevMap.get(r.query!)
    const pClicks = prev?._sum.clicks || 0
    const pImpr = prev?._sum.impressions || 0
    const pPos = prev?._avg.position || 0

    const currCtr = ctr(clicks, impressions)
    const prevCtr = ctr(pClicks, pImpr)

    return {
      query: r.query!,
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
