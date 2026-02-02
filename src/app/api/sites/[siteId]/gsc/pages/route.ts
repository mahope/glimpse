import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const days = Number(searchParams.get('days') || '30')
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('pageSize') || '50')

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)

  const rows = await prisma.searchStatDaily.groupBy({
    by: ['pageUrl'],
    where: { siteId: site.id, date: { gte: start, lte: end } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
    orderBy: { _sum: { clicks: 'desc' } },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  const items = rows.map(r => ({
    pageUrl: r.pageUrl!,
    clicks30: r._sum.clicks || 0,
    impressions30: r._sum.impressions || 0,
    ctr30: (r._sum.impressions ? ((r._sum.clicks || 0) / (r._sum.impressions || 1)) * 100 : 0),
    position30: r._avg.position || 0,
    trendClick: 0,
    trendImpr: 0,
  }))

  return NextResponse.json({ items, page, pageSize })
}
