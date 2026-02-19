import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/sites/[siteId]/perf/daily')

export async function GET(request: NextRequest, { params }: { params: { siteId: string } }) {
  try {
    const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    const hasCustomRange = fromRaw && toRaw && DATE_RE.test(fromRaw) && DATE_RE.test(toRaw)

    let days: number
    let since: Date
    let until: Date | undefined

    if (hasCustomRange) {
      since = new Date(fromRaw + 'T00:00:00')
      until = new Date(toRaw + 'T23:59:59')
      days = Math.round((until.getTime() - since.getTime()) / (1000 * 60 * 60 * 24))
      days = Math.min(Math.max(days, 1), 365)
    } else {
      days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30', 10)))
      since = new Date()
      since.setDate(since.getDate() - days)
    }

    const deviceParam = (searchParams.get('device') || 'ALL').toUpperCase()
    const device = deviceParam === 'MOBILE' || deviceParam === 'DESKTOP' ? deviceParam : 'ALL'

    // Verify org access
    const site = await prisma.site.findUnique({
      where: { id: params.siteId },
      include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    const isAdmin = session.user.role === 'ADMIN'
    const hasOrgAccess = site.organization.members.length > 0
    if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const rows = await prisma.sitePerfDaily.findMany({
      where: { siteId: site.id, date: { gte: since, ...(until ? { lte: until } : {}) }, ...(device === 'ALL' ? {} : { device }) },
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
    log.error({ err }, 'Perf daily error')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
