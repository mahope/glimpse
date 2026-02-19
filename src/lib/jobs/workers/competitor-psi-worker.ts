import { Worker, Job } from 'bullmq'
import { redisConnection, CompetitorPsiJobData } from '../queue'
import { prisma } from '@/lib/db'
import { runPsi } from '@/lib/perf/psi-service'
import { jobLogger } from '@/lib/logger'
import { moveToDeadLetter } from '../dead-letter'

export const competitorPsiWorker = new Worker<CompetitorPsiJobData>(
  'competitor-psi',
  async (job: Job<CompetitorPsiJobData>) => {
    const { siteId } = job.data
    const log = jobLogger('competitor-psi', job.id, { siteId })

    const competitors = await prisma.competitor.findMany({
      where: { site: { id: siteId, isActive: true } },
      select: { id: true, url: true, name: true },
    })

    if (competitors.length === 0) {
      log.info('No competitors found for site, skipping')
      return { siteId, tested: 0 }
    }

    await job.updateProgress(10)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let tested = 0
    const total = competitors.length

    for (const competitor of competitors) {
      try {
        const metrics = await runPsi(competitor.url, 'MOBILE')

        const snapshotData = {
          perfScore: metrics.perfScore ?? null,
          lcpMs: metrics.lcpMs != null ? Math.round(metrics.lcpMs) : null,
          inpMs: metrics.inpMs != null ? Math.round(metrics.inpMs) : null,
          cls: metrics.cls ?? null,
          ttfbMs: metrics.ttfbMs != null ? Math.round(metrics.ttfbMs) : null,
        }

        await prisma.competitorSnapshot.upsert({
          where: {
            competitorId_date: { competitorId: competitor.id, date: today },
          },
          update: snapshotData,
          create: { competitorId: competitor.id, date: today, ...snapshotData },
        })

        tested++
        log.info({ competitor: competitor.name, perfScore: metrics.perfScore }, 'Competitor PSI test complete')
      } catch (error) {
        log.error({ competitor: competitor.name, err: error }, 'Competitor PSI test failed, continuing with next')
      }

      await job.updateProgress(10 + Math.round((tested / total) * 90))

      // Pace PSI calls to avoid 429s
      if (tested < total) {
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    return { siteId, tested, total }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    limiter: {
      max: 3,
      duration: 60000,
    },
  }
)

competitorPsiWorker.on('failed', async (job, error) => {
  const log = jobLogger('competitor-psi', job?.id)
  log.error({ err: error }, 'Competitor PSI job failed')
  await moveToDeadLetter(job, error)
})

competitorPsiWorker.on('completed', (job, result) => {
  const log = jobLogger('competitor-psi', job.id)
  log.info({ result }, 'Competitor PSI job completed')
})
