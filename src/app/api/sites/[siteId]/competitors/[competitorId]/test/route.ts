import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { runPsi } from '@/lib/perf/psi-service'

export async function POST(req: NextRequest, { params }: { params: { siteId: string; competitorId: string } }) {
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

  try {
    const metrics = await runPsi(competitor.url, 'MOBILE')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const snapshotData = {
      perfScore: metrics.perfScore ?? null,
      lcpMs: metrics.lcpMs != null ? Math.round(metrics.lcpMs) : null,
      inpMs: metrics.inpMs != null ? Math.round(metrics.inpMs) : null,
      cls: metrics.cls ?? null,
      ttfbMs: metrics.ttfbMs != null ? Math.round(metrics.ttfbMs) : null,
    }

    const snapshot = await prisma.competitorSnapshot.upsert({
      where: {
        competitorId_date: { competitorId: competitor.id, date: today },
      },
      update: snapshotData,
      create: { competitorId: competitor.id, date: today, ...snapshotData },
    })

    return NextResponse.json({
      date: snapshot.date.toISOString().split('T')[0],
      perfScore: snapshot.perfScore,
      lcpMs: snapshot.lcpMs,
      inpMs: snapshot.inpMs,
      cls: snapshot.cls,
      ttfbMs: snapshot.ttfbMs,
    })
  } catch (error) {
    console.error('Competitor PSI test failed:', error)
    return NextResponse.json({ error: 'PSI test failed' }, { status: 500 })
  }
}
