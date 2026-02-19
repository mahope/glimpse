import { Worker, Job } from 'bullmq'
import { redisConnection, PerformanceTestJobData } from '../queue'
import { prisma } from '@/lib/db'
import { runPsi, saveSnapshot, upsertDaily } from '@/lib/perf/psi-service'
import { jobLogger } from '@/lib/logger'
import { moveToDeadLetter } from '../dead-letter'

export const perfWorker = new Worker<PerformanceTestJobData>(
  'performance-test',
  async (job: Job<PerformanceTestJobData>) => {
    const { siteId, url, device } = job.data

    const site = await prisma.site.findFirst({ where: { id: siteId, isActive: true } })
    if (!site) throw new Error(`Site ${siteId} not found or inactive`)

    await job.updateProgress(10)

    const metrics = await runPsi(url, device)
    await job.updateProgress(60)

    await saveSnapshot(siteId, metrics)
    await job.updateProgress(80)

    await upsertDaily(siteId, new Date())
    await job.updateProgress(100)

    return {
      siteId,
      url,
      device,
      perfScore: metrics.perfScore,
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  }
)

perfWorker.on('failed', async (job, err) => {
  const log = jobLogger('performance-test', job?.id)
  log.error({ err }, 'Performance test job failed')
  await moveToDeadLetter(job, err)
})

perfWorker.on('completed', (job, result) => {
  const log = jobLogger('performance-test', job.id)
  log.info({ result }, 'Performance test job completed')
})
