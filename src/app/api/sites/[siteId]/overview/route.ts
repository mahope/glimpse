import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

function pctDelta(curr: number, prev: number) {
  if (!isFinite(curr)) curr = 0
  if (!isFinite(prev)) prev = 0
  if (prev === 0) return curr === 0 ? 0 : 100
  return ((curr - prev) / Math.abs(prev)) * 100
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

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)
  const prevEnd = new Date(start); const prevStart = new Date(start); prevStart.setDate(prevEnd.getDate() - days)

  const whereBase: any = { siteId: site.id }
  if (device !== 'all') whereBase.device = device
  if (country !== 'ALL') whereBase.country = country

  // Aggregate current period
  const currAgg = await prisma.searchStatDaily.aggregate({
    where: { ...whereBase, date: { gte: start, lte: end } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true }
  })

  // Aggregate previous period
  const prevAgg = await prisma.searchStatDaily.aggregate({
    where: { ...whereBase, date: { gte: prevStart, lte: prevEnd } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true }
  })

  const clicks = currAgg._sum.clicks || 0
  const impressions = currAgg._sum.impressions || 0
  const position = currAgg._avg.position || 0
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

  const pClicks = prevAgg._sum.clicks || 0
  const pImpr = prevAgg._sum.impressions || 0
  const pPos = prevAgg._avg.position || 0
  const pCtr = pImpr > 0 ? (pClicks / pImpr) * 100 : 0

  // Timeline for trend charts (daily)
  const timelineRows = await prisma.searchStatDaily.groupBy({
    by: ['date'],
    where: { ...whereBase, date: { gte: start, lte: end } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
    orderBy: { date: 'asc' }
  })

  const timeline = timelineRows.map(r => ({
    date: r.date.toISOString().split('T')[0],
    clicks: r._sum.clicks || 0,
    impressions: r._sum.impressions || 0,
    ctr: (r._sum.impressions || 0) > 0 ? ((r._sum.clicks || 0) / (r._sum.impressions || 1)) * 100 : 0,
    position: r._avg.position || 0,
  }))

  const result = {
    range: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], days },
    kpis: {
      clicks: { value: clicks, deltaPct: pctDelta(clicks, pClicks) },
      impressions: { value: impressions, deltaPct: pctDelta(impressions, pImpr) },
      ctr: { value: ctr, deltaPct: pctDelta(ctr, pCtr) },
      position: { value: position, deltaPct: pctDelta(position, pPos) },
    },
    timeline
  }

  return NextResponse.json(result)
}
