import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

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

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(Number(searchParams.get('days') || 30), 7), 365)

  const start = new Date()
  start.setDate(start.getDate() - days)

  const snapshots = await prisma.competitorSnapshot.findMany({
    where: { competitorId: competitor.id, date: { gte: start } },
    orderBy: { date: 'asc' },
    select: { date: true, perfScore: true, lcpMs: true, inpMs: true, cls: true, ttfbMs: true },
  })

  return NextResponse.json({
    competitorName: competitor.name,
    snapshots: snapshots.map(s => ({
      date: s.date.toISOString().split('T')[0],
      perfScore: s.perfScore,
      lcpMs: s.lcpMs,
      inpMs: s.inpMs,
      cls: s.cls,
      ttfbMs: s.ttfbMs,
    })),
  })
}
