import { Worker, Job } from 'bullmq'
import { redisConnection } from '../queue'
import { prisma } from '@/lib/db'
import { runPsi, saveSnapshot, upsertDaily, Strategy } from '@/lib/perf/psi-service'

export type PerfFetchJob = {
  siteId: string
  organizationId?: string
  url: string
  strategy: Strategy
}

export const perfQueueName = 'perf:fetch'

export const perfWorker = new Worker<PerfFetchJob>(
  perfQueueName,
  async (job: Job<PerfFetchJob>) => {
    const { siteId, url, strategy } = job.data

    // Verify site exists and active
    const site = await prisma.site.findFirst({ where: { id: siteId, isActive: true } })
    if (!site) throw new Error(`Site ${siteId} not found or inactive`)

    await job.updateProgress(10)

    const metrics = await runPsi(url, strategy)
    await job.updateProgress(60)

    await saveSnapshot(siteId, metrics)
    await job.updateProgress(80)

    await upsertDaily(siteId, new Date())
    await job.updateProgress(100)

    return {
      siteId,
      url,
      strategy,
      perfScore: metrics.perfScore,
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
    // Backoff is also handled internally in psi-service; keep job-level too
    settings: { backoffStrategies: {} },
    limiter: { max: 10, duration: 60000 },
  }
)

perfWorker.on('failed', (job, err) => {
  console.error(`[perf:fetch] job ${job?.id} failed`, err)
})

perfWorker.on('completed', (job, result) => {
  console.log(`[perf:fetch] job ${job.id} completed`, result)
})
