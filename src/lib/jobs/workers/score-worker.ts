import { Worker, Job } from 'bullmq'
import { redisConnection, ScoreCalculationJobData } from '../queue'
import { SEOCalculator } from '@/lib/scoring/calculator'
import { prisma } from '@/lib/db'
import { jobLogger } from '@/lib/logger'

export const scoreWorker = new Worker<ScoreCalculationJobData>(
  'score-calculation',
  async (job: Job<ScoreCalculationJobData>) => {
    const { siteId, organizationId, date } = job.data
    const targetDate = date ? new Date(date) : new Date()

    try {
      await job.updateProgress(10)

      // Verify site ownership
      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          organizationId: organizationId,
          isActive: true,
        },
      })

      if (!site) {
        throw new Error(`Site ${siteId} not found or inactive`)
      }

      await job.updateProgress(25)

      // Calculate the SEO score using unified calculator (PRD-aligned)
      // calculateSEOScore internally calls storeSEOScore with today's date.
      // We then call storeSEOScore again with the targetDate to ensure the
      // score is persisted at the correct date (both use upsert, so this is safe).
      const scoreResult = await SEOCalculator.calculateSEOScore(siteId)

      await job.updateProgress(80)

      // Persist at targetDate (no-op if targetDate === today since calculator already upserted)
      await SEOCalculator.storeSEOScore(
        siteId,
        {
          clickTrend: scoreResult.clickTrend,
          positionTrend: scoreResult.positionTrend,
          impressionTrend: scoreResult.impressionTrend,
          ctrBenchmark: scoreResult.ctrBenchmark,
          performanceScore: scoreResult.performanceScore,
        },
        scoreResult.overall,
        targetDate
      )

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        date: targetDate.toISOString(),
        score: scoreResult.overall,
      }
    } catch (error) {
      const log = jobLogger('score-calculation', job.id, { siteId })
      log.error({ siteId, err: error }, 'Score calculation failed')
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 60000,
    },
  }
)

scoreWorker.on('failed', (job, error) => {
  const log = jobLogger('score-calculation', job?.id)
  log.error({ err: error }, 'Score calculation job failed')
})

scoreWorker.on('completed', (job, result) => {
  const log = jobLogger('score-calculation', job.id)
  log.info({ result }, 'Score calculation job completed')
})
