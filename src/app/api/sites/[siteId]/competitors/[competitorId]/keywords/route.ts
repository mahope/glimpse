import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { analyzeKeywordOverlap } from '@/lib/competitors/keyword-analysis'
import { findMatchedSite } from '@/lib/competitors/match-site'

export async function GET(req: NextRequest, { params }: { params: { siteId: string; competitorId: string } }) {
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

  const matchedSite = await findMatchedSite(competitor.url, organizationId, site.id)

  if (!matchedSite) {
    return NextResponse.json({
      available: false,
      message: 'Konkurrenten er ikke et site i Glimpse. Keyword-overlap kræver at begge sites er tilsluttet.',
      competitorName: competitor.name,
      competitorUrl: competitor.url,
    })
  }

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(Number(searchParams.get('days') || 30), 7), 365)

  try {
    const result = await analyzeKeywordOverlap(site.id, matchedSite.id, days)

    return NextResponse.json({
      available: true,
      competitorName: competitor.name,
      competitorUrl: competitor.url,
      matchedSiteName: matchedSite.name,
      days,
      ...result,
    })
  } catch (error) {
    console.error('Keyword overlap analysis failed:', error)
    return NextResponse.json({ error: 'Keyword overlap analysis failed' }, { status: 500 })
  }
}
