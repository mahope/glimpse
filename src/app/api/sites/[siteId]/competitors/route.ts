import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { z } from 'zod'

const MAX_COMPETITORS = 5

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().url().max(500),
})

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const competitors = await prisma.competitor.findMany({
    where: { siteId: site.id },
    include: {
      snapshots: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Also fetch the site's own latest perf for comparison
  const sitePerf = await prisma.perfSnapshot.findFirst({
    where: { siteId: site.id, strategy: 'MOBILE' },
    orderBy: { date: 'desc' },
    select: { perfScore: true, lcpMs: true, inpMs: true, cls: true, ttfbMs: true, date: true },
  })

  const result = competitors.map(c => {
    const snap = c.snapshots[0] ?? null
    return {
      id: c.id,
      name: c.name,
      url: c.url,
      createdAt: c.createdAt.toISOString(),
      latestSnapshot: snap ? {
        date: snap.date.toISOString().split('T')[0],
        perfScore: snap.perfScore,
        lcpMs: snap.lcpMs,
        inpMs: snap.inpMs,
        cls: snap.cls,
        ttfbMs: snap.ttfbMs,
      } : null,
    }
  })

  return NextResponse.json({
    site: {
      name: site.name,
      domain: site.domain,
      latestPerf: sitePerf ? {
        date: sitePerf.date.toISOString().split('T')[0],
        perfScore: sitePerf.perfScore,
        lcpMs: sitePerf.lcpMs,
        inpMs: sitePerf.inpMs,
        cls: sitePerf.cls,
        ttfbMs: sitePerf.ttfbMs,
      } : null,
    },
    competitors: result,
    maxCompetitors: MAX_COMPETITORS,
  })
}

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = CreateSchema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'Invalid data', details: body.error.errors }, { status: 400 })

  try {
    const competitor = await prisma.$transaction(async (tx) => {
      const count = await tx.competitor.count({ where: { siteId: site.id } })
      if (count >= MAX_COMPETITORS) {
        throw new Error('MAX_LIMIT')
      }
      const existing = await tx.competitor.findFirst({
        where: { siteId: site.id, url: body.data.url },
      })
      if (existing) throw new Error('DUPLICATE')

      return tx.competitor.create({
        data: { siteId: site.id, name: body.data.name, url: body.data.url },
      })
    })
    return NextResponse.json(competitor, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'MAX_LIMIT') return NextResponse.json({ error: `Maks ${MAX_COMPETITORS} konkurrenter per site` }, { status: 400 })
    if (msg === 'DUPLICATE') return NextResponse.json({ error: 'Konkurrent med denne URL findes allerede' }, { status: 409 })
    return NextResponse.json({ error: 'Kunne ikke oprette konkurrent' }, { status: 500 })
  }
}
