import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron/auth'
import { prisma } from '@/lib/db'
import { Queue } from 'bullmq'
import { redisConnection } from '@/lib/jobs/queue'
import { perfQueueName, PerfFetchJob } from '@/lib/jobs/workers/perf-worker'

export async function POST(request: NextRequest) {
  const unauthorized = verifyCronSecret(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('siteId')
  const limit = Number(searchParams.get('limit') || '10')

  // Fetch verified active sites
  const sites = await prisma.site.findMany({
    where: siteId ? { id: siteId, isActive: true } : { isActive: true },
    take: siteId ? 1 : undefined,
    select: { id: true, url: true },
  })

  const queue = new Queue<PerfFetchJob>(perfQueueName, { connection: redisConnection })

  let count = 0
  for (const site of sites) {
    // For now, enqueue the homepage only; future: use crawl results or sitemaps
    const urls = [site.url]
    for (const u of urls.slice(0, limit)) {
      for (const strategy of ['MOBILE', 'DESKTOP'] as const) {
        await queue.add('fetch', { siteId: site.id, organizationId: '', url: u, strategy }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 20,
        })
        count++
      }
    }
  }

  return NextResponse.json({ enqueued: count })
}
