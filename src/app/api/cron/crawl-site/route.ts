import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCronSecret } from '@/lib/cron/auth'
import { scheduleJob } from '@/lib/jobs/queue'

export async function POST(request: NextRequest) {
  const unauthorized = verifyCronSecret(request)
  if (unauthorized) return unauthorized

  const sites = await prisma.site.findMany({ where: { isActive: true }, select: { id: true, organizationId: true, url: true } })
  let enqueued = 0
  for (const s of sites) {
    await scheduleJob.siteCrawl({ siteId: s.id, organizationId: s.organizationId, url: s.url, maxPages: 50 })
    enqueued++
  }
  return NextResponse.json({ enqueued, skipped: 0 })
}
