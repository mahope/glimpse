import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function DELETE(req: NextRequest, { params }: { params: { siteId: string; competitorId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const competitor = await prisma.competitor.findFirst({
    where: { id: params.competitorId, siteId: site.id },
  })
  if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

  await prisma.competitor.delete({ where: { id: competitor.id } })

  return NextResponse.json({ ok: true })
}
