import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import {
  getTrackedRoutes,
  getApiLatencyStats,
  getCounterSum,
  getCounterTimeSeries,
} from '@/lib/metrics/collector'
import { gscSyncQueue, performanceQueue, crawlQueue, scoreQueue, uptimeCheckQueue } from '@/lib/jobs/queue'

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [
      entityCounts,
      apiLatencies,
      psiMetrics,
      queueDepths,
      crawlMetrics,
      psiTimeSeries,
      errorTimeSeries,
    ] = await Promise.all([
      getEntityCounts(),
      getApiLatencies(),
      getPsiMetrics(),
      getQueueDepths(),
      getCrawlMetrics(),
      getCounterTimeSeries('psi:calls', 24),
      getCounterTimeSeries('psi:errors', 24),
    ])

    return NextResponse.json({
      entities: entityCounts,
      apiLatencies,
      psi: psiMetrics,
      queues: queueDepths,
      crawl: crawlMetrics,
      timeSeries: {
        psiCalls: psiTimeSeries,
        psiErrors: errorTimeSeries,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to collect metrics:', error)
    return NextResponse.json({ error: 'Failed to collect metrics' }, { status: 500 })
  }
}

async function getEntityCounts() {
  const [sites, organizations, users] = await Promise.all([
    prisma.site.count({ where: { isActive: true } }),
    prisma.organization.count(),
    prisma.user.count(),
  ])
  return { activeSites: sites, organizations, users }
}

async function getApiLatencies() {
  const routes = await getTrackedRoutes()
  const stats = await Promise.all(
    routes.slice(0, 20).map(async (route) => ({
      route,
      ...(await getApiLatencyStats(route)),
    }))
  )
  return stats.filter(s => s.count > 0).sort((a, b) => b.count - a.count)
}

async function getPsiMetrics() {
  const [calls24h, errors24h] = await Promise.all([
    getCounterSum('psi:calls', 24),
    getCounterSum('psi:errors', 24),
  ])
  return {
    calls24h,
    errors24h,
    errorRate: calls24h > 0 ? Math.round((errors24h / calls24h) * 100) : 0,
  }
}

async function getQueueDepths() {
  const queues = [
    { name: 'gsc-sync', queue: gscSyncQueue },
    { name: 'performance-test', queue: performanceQueue },
    { name: 'site-crawl', queue: crawlQueue },
    { name: 'score-calculation', queue: scoreQueue },
    { name: 'uptime-check', queue: uptimeCheckQueue },
  ]

  return Promise.all(
    queues.map(async ({ name, queue }) => {
      try {
        const [waiting, active, delayed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getFailedCount(),
        ])
        return { name, waiting, active, delayed, failed, total: waiting + active + delayed }
      } catch {
        return { name, waiting: 0, active: 0, delayed: 0, failed: 0, total: 0 }
      }
    })
  )
}

async function getCrawlMetrics() {
  const [duration24h, pages24h] = await Promise.all([
    getCounterSum('crawl:duration_s', 24),
    getCounterSum('crawl:pages', 24),
  ])
  return {
    totalDuration24h: duration24h,
    totalPages24h: pages24h,
    pagesPerSecond: duration24h > 0 ? Math.round((pages24h / duration24h) * 10) / 10 : 0,
  }
}
