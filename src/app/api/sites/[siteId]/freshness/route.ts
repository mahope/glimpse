import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(_req: NextRequest, { params }: { params: { siteId: string } }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = session.session.activeOrganizationId
    if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

    const site = await prisma.site.findFirst({
      where: { id: params.siteId, organizationId },
      select: { id: true, gscLastSyncedAt: true },
    })
    if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [gscLatest, perfLatest, crawlLatest] = await Promise.all([
      prisma.searchStatDaily.findFirst({
        where: { siteId: site.id },
        orderBy: { date: 'desc' },
        select: { date: true, createdAt: true },
      }),
      prisma.sitePerfDaily.findFirst({
        where: { siteId: site.id },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      prisma.crawlResult.findFirst({
        where: { siteId: site.id },
        orderBy: { crawlDate: 'desc' },
        select: { crawlDate: true },
      }),
    ])

    return NextResponse.json({
      gsc: gscLatest ? { date: gscLatest.date, syncedAt: site.gscLastSyncedAt ?? gscLatest.createdAt } : null,
      perf: perfLatest ? { date: perfLatest.date } : null,
      crawl: crawlLatest ? { date: crawlLatest.crawlDate } : null,
    })
  } catch (err) {
    console.error('[freshness] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
