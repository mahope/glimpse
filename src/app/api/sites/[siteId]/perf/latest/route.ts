import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/sites/[siteId]/perf/latest')

export async function GET(request: NextRequest, { params }: { params: { siteId: string } }) {
  try {
    const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const strategy = (searchParams.get('strategy') || 'MOBILE').toUpperCase() as 'MOBILE' | 'DESKTOP'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)))
    const skip = (page - 1) * pageSize

    // Verify org access
    const site = await prisma.site.findUnique({
      where: { id: params.siteId },
      include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const hasOrgAccess = site.organization.members.length > 0
    if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    // Total distinct URLs for pagination
    const groups = await prisma.perfSnapshot.groupBy({ by: ['url'], where: { siteId: site.id, strategy } })
    const total = groups.length

    // Latest snapshot per URL using DISTINCT ON ordering trick (Postgres)
    const items = await prisma.perfSnapshot.findMany({
      where: { siteId: site.id, strategy },
      orderBy: [ { url: 'asc' }, { date: 'desc' } ],
      distinct: ['url'],
      take: pageSize,
      skip,
    })

    return NextResponse.json({
      items: items.map(s => ({
        id: s.id,
        url: s.url,
        strategy: s.strategy,
        lcpMs: s.lcpMs,
        inpMs: s.inpMs,
        cls: s.cls,
        ttfbMs: s.ttfbMs,
        perfScore: s.perfScore,
        snapshotTime: s.date,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (err) {
    log.error({ err }, 'Perf latest error')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
