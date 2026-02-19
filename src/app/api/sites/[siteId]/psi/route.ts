import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runPsi, saveSnapshot, type Strategy } from '@/lib/perf/psi-service'
import { rateLimitOrNull } from '@/lib/rate-limit'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/sites/[siteId]/psi')

export async function POST(request: NextRequest, { params }: { params: { siteId: string } }) {
  try {
    const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: max 5 PSI tests per site per hour
    const rl = await rateLimitOrNull(`psi:${params.siteId}`, { limit: 5, windowSeconds: 3600 })
    if (rl) return rl

    const { url: bodyUrl } = await request.json().catch(() => ({} as any))

    // Verify access to site/org
    const site = await prisma.site.findUnique({
      where: { id: params.siteId },
      include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const hasOrgAccess = site.organization.members.length > 0
    if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const targetUrl = typeof bodyUrl === 'string' && bodyUrl.length ? bodyUrl : site.url
    if (!targetUrl) return NextResponse.json({ error: 'No URL to test' }, { status: 400 })

    const strategies: Strategy[] = ['MOBILE', 'DESKTOP']
    const created: any[] = []

    for (const strategy of strategies) {
      const metrics = await runPsi(targetUrl, strategy)
      await saveSnapshot(site.id, metrics)
      created.push({
        url: targetUrl,
        strategy,
        perfScore: metrics.perfScore,
        lcpMs: metrics.lcpMs,
        inpMs: metrics.inpMs,
        cls: metrics.cls,
        ttfbMs: metrics.ttfbMs,
        date: metrics.date,
      })
    }

    return NextResponse.json({ siteId: site.id, url: targetUrl, records: created })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Invalid payload', details: err.errors }, { status: 400 })
    log.error({ err }, 'PSI POST error')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
