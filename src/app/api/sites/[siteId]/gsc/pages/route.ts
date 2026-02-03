import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { parseParams, ctr, safePctDelta, positionImprovementPct } from '@/lib/gsc/params'
import { sortItems } from '@/lib/gsc/sort'

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

  const cap = Math.min(page * pageSize + 500, 5000)

  const rows = await prisma.searchStatDaily.groupBy({
    by: ['pageUrl'],
    where: { ...whereBase, date: { gte: start, lte: end } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
    orderBy: { _sum: { clicks: 'desc' } },
    take: cap,
  })

  const totalGroups = await prisma.searchStatDaily.groupBy({
    by: ['pageUrl'],
    where: { ...whereBase, date: { gte: start, lte: end } },
    _count: { pageUrl: true },
  })
  const totalItems = totalGroups.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const prevRows = await prisma.searchStatDaily.groupBy({
    by: ['pageUrl'],
    where: { ...whereBase, date: { gte: prevStart, lte: prevEnd } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
  })
  const prevMap = new Map(prevRows.map(r => [r.pageUrl!, r]))

  const itemsAll = rows.map(r => {
    const clicks = r._sum.clicks || 0
    const impressions = r._sum.impressions || 0
    const position = r._avg.position || 0

    const prev = prevMap.get(r.pageUrl!)
    let pClicks = prev?._sum.clicks || 0
    let pImpr = prev?._sum.impressions || 0
    let pPos = prev?._avg.position || 0

    if (process.env.MOCK_GSC === 'true' && pClicks === 0 && pImpr === 0 && pPos === 0) {
      pClicks = Math.max(0, Math.round(clicks * 0.8))
      pImpr = Math.max(0, Math.round(impressions * 0.9))
      pPos = position * 1.1
    }

    const currCtr = ctr(clicks, impressions)
    const prevCtr = ctr(pClicks, pImpr)

    return {
      key: r.pageUrl!,
      pageUrl: r.pageUrl!,
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

  const sorted = sortItems(itemsAll, sortField as any, sortDir as any)
  const startIdx = (page - 1) * pageSize
  const items = sorted.slice(startIdx, startIdx + pageSize)

  return NextResponse.json({ items, page, pageSize, totalItems, totalPages, sortField, sortDir })
}
