import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fetchPsi, type Strategy } from '@/lib/perf/psi'

// Simple in-memory cache (process local)
const cache = new Map<string, { at: number; ttl: number; data: any }>()
const DEFAULT_TTL_MS = 1000 * 60 * 30 // 30 minutes

function key(siteId: string, strategy: Strategy) { return `${siteId}:${strategy}` }

export async function GET(request: NextRequest, { params }: { params: { siteId: string } }) {
  try {
    const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify access to site
    const site = await prisma.site.findUnique({ where: { id: params.siteId }, include: { organization: { include: { members: { where: { userId: session.user.id } } } } } })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const hasOrgAccess = site.organization.members.length > 0
    if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const strat = (searchParams.get('strategy') as Strategy) || undefined
    const refresh = searchParams.get('refresh') === '1'

    const strategies: Strategy[] = strat === 'mobile' || strat === 'desktop' ? [strat] : ['mobile', 'desktop']

    const results: Record<string, any> = {}
    for (const s of strategies) {
      const k = key(site.id, s)
      const now = Date.now()
      const cached = cache.get(k)
      const valid = cached && now - cached.at < (cached.ttl || DEFAULT_TTL_MS)
      if (cached && valid && !refresh) {
        results[s] = { ...cached.data, cachedAt: new Date(cached.at).toISOString() }
        continue
      }

      try {
        const data = await fetchPsi(site.url, s)
        const normalized = {
          score: data.lab.score,
          lcp: data.lab.lcp ?? data.field.lcp,
          inp: data.lab.inp ?? data.field.inp,
          cls: data.lab.cls ?? data.field.cls,
          fcp: data.lab.fcp ?? data.field.fcp,
          tbt: data.lab.tbt,
          fid: data.lab.fid,
          diagnostics: data.diagnostics,
          timestamp: data.timestamp,
          reportLink: data.diagnostics.reportLink,
        }
        cache.set(k, { at: now, ttl: DEFAULT_TTL_MS, data: normalized })
        results[s] = { ...normalized, cachedAt: new Date(now).toISOString() }
      } catch (err: any) {
        results[s] = { error: err?.message || 'Failed to fetch PSI' }
      }
    }

    return NextResponse.json({ siteId: site.id, url: site.url, results })
  } catch (err) {
    console.error('perf api error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
