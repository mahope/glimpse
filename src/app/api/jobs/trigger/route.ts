import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { triggerJob } from '@/lib/jobs/queue'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { rateLimitOrNull } from '@/lib/rate-limit'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/jobs/trigger')

const TriggerJobSchema = z.object({
  type: z.enum(['gsc-sync', 'performance-test', 'site-crawl', 'score-calculation']),
  siteId: z.string(),
  device: z.enum(['MOBILE', 'DESKTOP']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: max 10 job triggers per user per minute
    const rl = await rateLimitOrNull(`jobs:${session.user.id}`, { limit: 10, windowSeconds: 60 })
    if (rl) return rl

    const body = await request.json()
    const { type, siteId, device } = TriggerJobSchema.parse(body)

    // Get user's active organization
    const organizationId = session.session.activeOrganizationId
    if (!organizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 })
    }

    // Verify site ownership
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: organizationId,
        isActive: true,
      },
    })

    if (!site) {
      return NextResponse.json({ error: 'Site not found or access denied' }, { status: 404 })
    }

    let jobResult

    switch (type) {
      case 'gsc-sync':
        jobResult = await triggerJob.gscSync(siteId, organizationId)
        break

      case 'performance-test':
        if (!device) {
          return NextResponse.json({ error: 'Device required for performance test' }, { status: 400 })
        }
        jobResult = await triggerJob.performanceTest(siteId, organizationId, site.url, device)
        break

      case 'site-crawl':
        jobResult = await triggerJob.siteCrawl(siteId, organizationId, site.url)
        break

      case 'score-calculation':
        jobResult = await triggerJob.scoreCalculation(siteId, organizationId)
        break

      default:
        return NextResponse.json({ error: 'Invalid job type' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      jobId: jobResult.id,
      type,
      siteId,
      siteName: site.name,
    })
  } catch (error) {
    log.error({ err: error }, 'Failed to trigger job')
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to trigger job' },
      { status: 500 }
    )
  }
}