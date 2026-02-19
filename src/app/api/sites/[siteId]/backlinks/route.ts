import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(Number(searchParams.get('days') || 30), 7), 365)

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)

  const [latestSnapshot, prevSnapshot, snapshots, referringDomains, newDomains] = await Promise.all([
    prisma.backlinkSnapshot.findFirst({
      where: { siteId: site.id },
      orderBy: { date: 'desc' },
    }),
    prisma.backlinkSnapshot.findFirst({
      where: { siteId: site.id, date: { lt: start } },
      orderBy: { date: 'desc' },
    }),
    prisma.backlinkSnapshot.findMany({
      where: { siteId: site.id, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
      select: { date: true, totalLinks: true, totalReferringDomains: true },
    }),
    prisma.referringDomain.findMany({
      where: { siteId: site.id },
      orderBy: { linkCount: 'desc' },
      take: 50,
      select: { domain: true, linkCount: true, firstSeen: true, lastSeen: true },
    }),
    prisma.referringDomain.count({
      where: { siteId: site.id, firstSeen: { gte: start } },
    }),
  ])

  const currLinks = latestSnapshot?.totalLinks ?? 0
  const currDomains = latestSnapshot?.totalReferringDomains ?? 0
  const prevLinks = prevSnapshot?.totalLinks ?? 0
  const prevDomains = prevSnapshot?.totalReferringDomains ?? 0

  return NextResponse.json({
    totals: {
      totalLinks: currLinks,
      totalReferringDomains: currDomains,
      linksDelta: prevSnapshot ? currLinks - prevLinks : 0,
      domainsDelta: prevSnapshot ? currDomains - prevDomains : 0,
      newDomains,
    },
    timeline: snapshots.map(s => ({
      date: s.date.toISOString().split('T')[0],
      totalLinks: s.totalLinks,
      totalReferringDomains: s.totalReferringDomains,
    })),
    referringDomains: referringDomains.map(rd => ({
      domain: rd.domain,
      linkCount: rd.linkCount,
      firstSeen: rd.firstSeen.toISOString().split('T')[0],
      lastSeen: rd.lastSeen.toISOString().split('T')[0],
    })),
  })
}
