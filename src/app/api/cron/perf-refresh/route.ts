import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron/auth'
import { prisma } from '@/lib/db'
import { triggerJob } from '@/lib/jobs/queue'

export async function POST(request: NextRequest) {
  const unauthorized = verifyCronSecret(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('siteId')

  const sites = await prisma.site.findMany({
    where: siteId ? { id: siteId, isActive: true } : { isActive: true },
    take: siteId ? 1 : undefined,
    select: { id: true, organizationId: true, url: true },
  })

  let count = 0
  for (const site of sites) {
    for (const device of ['MOBILE', 'DESKTOP'] as const) {
      await triggerJob.performanceTest(site.id, site.organizationId, site.url, device)
      count++
    }
  }

  return NextResponse.json({ enqueued: count })
}
