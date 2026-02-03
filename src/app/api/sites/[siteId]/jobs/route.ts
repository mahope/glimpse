import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { EnqueueJobBodySchema, GSCSyncSchema, PsiTestSchema, CrawlSchema, ScoreCalcSchema } from '@/lib/jobs/types'
import { triggerJob } from '@/lib/jobs/queue'

export async function POST(request: NextRequest, { params }: { params: { siteId: string } }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { kind, params: raw } = EnqueueJobBodySchema.parse(body)

    const organizationId = (session.session as any).activeOrganizationId
    if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

    const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId, isActive: true } })
    if (!site) return NextResponse.json({ error: 'Site not found or access denied' }, { status: 404 })

    switch (kind) {
      case 'gsc-sync': {
        const payload = GSCSyncSchema.parse({ siteId: site.id, organizationId })
        const job = await triggerJob.gscSync(payload.siteId, payload.organizationId)
        return NextResponse.json({ jobId: job.id })
      }
      case 'performance-test': {
        const payload = PsiTestSchema.parse({ siteId: site.id, organizationId, url: site.url, device: raw?.device })
        const job = await triggerJob.performanceTest(payload.siteId, payload.organizationId, payload.url, payload.device)
        return NextResponse.json({ jobId: job.id })
      }
      case 'site-crawl': {
        const payload = CrawlSchema.parse({ siteId: site.id, organizationId, url: site.url, maxPages: raw?.maxPages })
        const job = await triggerJob.siteCrawl(payload.siteId, payload.organizationId, payload.url, payload.maxPages)
        return NextResponse.json({ jobId: job.id })
      }
      case 'score-calculation': {
        const payload = ScoreCalcSchema.parse({ siteId: site.id, organizationId })
        const job = await triggerJob.scoreCalculation(payload.siteId, payload.organizationId)
        return NextResponse.json({ jobId: job.id })
      }
      default:
        return NextResponse.json({ error: 'Unsupported job kind' }, { status: 400 })
    }
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Invalid payload', details: err.errors }, { status: 400 })
    console.error('enqueue site job error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
