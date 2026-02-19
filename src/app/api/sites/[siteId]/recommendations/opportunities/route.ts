import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { findKeywordOpportunities } from '@/lib/recommendations/opportunities'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const days = Number(req.nextUrl.searchParams.get('days')) || 30

  try {
    const opportunities = await findKeywordOpportunities(site.id, days)
    return NextResponse.json({ opportunities })
  } catch (err) {
    console.error('Failed to find opportunities:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
