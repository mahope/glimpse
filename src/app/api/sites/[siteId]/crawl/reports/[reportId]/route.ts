import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { siteId: string, reportId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const report = await prisma.crawlReport.findFirst({ where: { id: params.reportId, siteId: site.id } })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ report })
}
