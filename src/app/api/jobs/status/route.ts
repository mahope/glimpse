import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { gscSyncQueue, performanceQueue, crawlQueue, scoreQueue, uptimeCheckQueue } from '@/lib/jobs/queue'
import { getDLQStats } from '@/lib/jobs/dead-letter'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/jobs/status')

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admin users to view job status
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get queue statistics
    const [gscStats, performanceStats, crawlStats, scoreStats, uptimeStats] = await Promise.all([
      getQueueStats(gscSyncQueue, 'GSC Sync'),
      getQueueStats(performanceQueue, 'Performance Tests'),
      getQueueStats(crawlQueue, 'Site Crawls'),
      getQueueStats(scoreQueue, 'Score Calculations'),
      getQueueStats(uptimeCheckQueue, 'Uptime Checks'),
    ])

    const dlq = await getDLQStats()

    return NextResponse.json({
      queues: [gscStats, performanceStats, crawlStats, scoreStats, uptimeStats],
      deadLetter: dlq,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.error({ err: error }, 'Failed to get job status')
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    )
  }
}

async function getQueueStats(queue: any, name: string) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(0, 9), // Last 10 completed jobs
    queue.getFailed(0, 9), // Last 10 failed jobs
    queue.getDelayed(),
  ])

  return {
    name,
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    recentCompleted: completed.map((job: any) => ({
      id: job.id,
      data: job.data,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
    })),
    recentFailed: failed.map((job: any) => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    })),
  }
}