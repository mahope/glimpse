import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { siteId: string } }) {
  try {
    const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30', 10)))
    const deviceParam = (searchParams.get('device') || 'ALL').toUpperCase()
    const device = deviceParam === 'MOBILE' || deviceParam === 'DESKTOP' ? deviceParam : 'ALL'

    // Verify org access
    const site = await prisma.site.findUnique({
      where: { id: params.siteId },
      include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const hasOrgAccess = site.organization.members.length > 0
    if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const since = new Date()
    since.setDate(since.getDate() - days)

    const rows = await prisma.sitePerfDaily.findMany({
      where: { siteId: site.id, date: { gte: since }, ...(device === 'ALL' ? {} : { device }) },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({
      items: rows.map(r => ({
        date: r.date,
        lcp: r.lcpPctl ?? null,
        inp: r.inpPctl ?? null,
        cls: r.clsPctl ?? null,
        scoreAvg: r.perfScoreAvg ?? null,
        pages: r.pagesMeasured,
      })),
    })
  } catch (err) {
    console.error('perf/daily error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
