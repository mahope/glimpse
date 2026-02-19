import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { toCsv, csvResponse } from '@/lib/csv'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const strategy = (searchParams.get('strategy') || 'MOBILE').toUpperCase() as 'MOBILE' | 'DESKTOP'

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get latest snapshot per URL (all pages, no pagination)
  const items = await prisma.perfSnapshot.findMany({
    where: { siteId: site.id, strategy },
    orderBy: [{ url: 'asc' }, { date: 'desc' }],
    distinct: ['url'],
    take: 10000,
  })

  const csvHeaders = ['URL', 'Strategy', 'LCP (ms)', 'INP (ms)', 'CLS', 'TTFB (ms)', 'Perf Score', 'Snapshot Time']
  const csvRows = items.map(s => [
    s.url,
    s.strategy,
    s.lcpMs != null ? Math.round(s.lcpMs) : null,
    s.inpMs != null ? Math.round(s.inpMs) : null,
    s.cls != null ? s.cls.toFixed(2) : null,
    s.ttfbMs != null ? Math.round(s.ttfbMs) : null,
    s.perfScore,
    s.date.toISOString(),
  ])

  const date = new Date().toISOString().split('T')[0]
  const filename = `${site.domain}-performance-${date}.csv`
  return csvResponse(toCsv(csvHeaders, csvRows), filename)
}
