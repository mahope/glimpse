import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(req: NextRequest, { params }: { params: { siteId: string; keyword: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(365, Math.max(7, parseInt(searchParams.get('days') || '90', 10)))
  const keyword = decodeURIComponent(params.keyword)

  const start = new Date()
  start.setDate(start.getDate() - days)

  // Daily aggregation for this keyword
  const daily = await prisma.searchStatDaily.groupBy({
    by: ['date'],
    where: {
      siteId: site.id,
      query: keyword,
      date: { gte: start },
    },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
    orderBy: { date: 'asc' },
  })

  // Site average position per day for comparison
  const siteAvg = await prisma.searchStatDaily.groupBy({
    by: ['date'],
    where: {
      siteId: site.id,
      date: { gte: start },
    },
    _avg: { position: true },
    orderBy: { date: 'asc' },
  })

  const siteAvgMap = new Map(siteAvg.map(r => [
    r.date.toISOString().split('T')[0],
    r._avg.position ?? 0,
  ]))

  const timeline = daily.map(r => ({
    date: r.date.toISOString().split('T')[0],
    clicks: r._sum.clicks ?? 0,
    impressions: r._sum.impressions ?? 0,
    position: Number((r._avg.position ?? 0).toFixed(1)),
    siteAvgPosition: Number((siteAvgMap.get(r.date.toISOString().split('T')[0]) ?? 0).toFixed(1)),
  }))

  return NextResponse.json({ keyword, days, timeline })
}
