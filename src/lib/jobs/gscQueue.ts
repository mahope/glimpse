import { Queue, Worker, JobsOptions } from 'bullmq'
import IORedis from 'ioredis'
import { fetchAndStoreGSCDaily } from '@/lib/gsc/fetch-daily'
import { prisma } from '@/lib/db'

const connectionString = process.env.REDIS_URL

export const hasRedis = !!connectionString

let connection: IORedis | undefined
let workerConnection: IORedis | undefined
let queue: Queue | undefined

export function getGSCQueue() {
  if (!hasRedis) return undefined
  if (!connection) {
    connection = new IORedis(connectionString as string, { maxRetriesPerRequest: 1, lazyConnect: true })
    connection.on('error', (err) => console.warn('[gsc:fetch] Redis error', err?.message))
  }
  if (!queue) {
    queue = new Queue('gsc:fetch', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 500,
      } as JobsOptions,
    })
  }
  return queue
}

export function startGSCWorker() {
  if (!hasRedis) {
    console.warn('[gsc:fetch] REDIS_URL not set. Worker disabled.')
    return undefined
  }
  if (!workerConnection) {
    workerConnection = new IORedis(connectionString as string, { maxRetriesPerRequest: null, lazyConnect: true })
    workerConnection.on('error', (err) => console.warn('[gsc:fetch] Worker Redis error', err?.message))
  }
  const worker = new Worker('gsc:fetch', async (job) => {
    const { siteId, days = 30 } = job.data as { siteId: string; days?: number }
    const site = await prisma.site.findUnique({ where: { id: siteId } })
    if (!site || !site.gscPropertyUrl) return { skipped: true }
    const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)
    return fetchAndStoreGSCDaily({
      siteId,
      propertyUrl: site.gscPropertyUrl,
      refreshToken: site.gscRefreshToken || undefined,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      mock: process.env.MOCK_GSC === 'true'
    })
  }, {
    connection: workerConnection,
    concurrency: 2,
    limiter: { max: 5, duration: 1000 }
  })
  worker.on('failed', (job, err) => {
    console.warn('[gsc:fetch] job failed', job?.id, err?.message)
  })
  worker.on('completed', (job) => {
    console.log('[gsc:fetch] job done', job.id)
  })
  return worker
}

export async function enqueueDailyForActiveSites(days = 30) {
  const q = getGSCQueue()
  if (!q) {
    console.warn('[gsc:fetch] No Redis; enqueue skipped')
    return { enqueued: 0 }
  }
  const sites = await prisma.site.findMany({ where: { isActive: true } })
  let count = 0
  for (const s of sites) {
    await q.add('fetch', { siteId: s.id, days }, { jobId: `site:${s.id}:d${days}` })
    count++
  }
  return { enqueued: count }
}
