import { Worker, Job } from 'bullmq'
import { redisConnection, ScoreCalculationJobData } from '../queue'
import { SEOCalculator } from '@/lib/scoring/calculator'
import { prisma } from '@/lib/db'

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

      // Check if we already have a score for this date
      const existingScore = await prisma.seoScore.findUnique({
        where: {
          siteId_date: {
            siteId,
            date: targetDate,
          },
        },
      })

      await job.updateProgress(50)

      // Calculate the SEO score using unified calculator (PRD-aligned)
      const scoreResult = await SEOCalculator.calculateSEOScore(siteId)
      // TODO: SEOCalculator already persists a score row for "now"; this worker also upserts at targetDate.
      // Consider de-duplicating persistence to avoid double writes.

      await job.updateProgress(80)

      // Update or create the SEO score record for the requested targetDate
      const seoScore = await prisma.seoScore.upsert({
        where: {
          siteId_date: {
            siteId,
            date: targetDate,
          },
        },
        update: {
          score: scoreResult.overall,
          clickTrend: scoreResult.clickTrend,
          positionTrend: scoreResult.positionTrend,
          impressionTrend: scoreResult.impressionTrend,
          ctrBenchmark: scoreResult.ctrBenchmark,
          performanceScore: scoreResult.performanceScore,
          breakdown: {
            overall: scoreResult.overall,
            clickTrend: scoreResult.clickTrend,
            positionTrend: scoreResult.positionTrend,
            impressionTrend: scoreResult.impressionTrend,
            ctrBenchmark: scoreResult.ctrBenchmark,
            performanceScore: scoreResult.performanceScore,
            grade: scoreResult.grade,
          },
        },
        create: {
          siteId,
          date: targetDate,
          score: scoreResult.overall,
          clickTrend: scoreResult.clickTrend,
          positionTrend: scoreResult.positionTrend,
          impressionTrend: scoreResult.impressionTrend,
          ctrBenchmark: scoreResult.ctrBenchmark,
          performanceScore: scoreResult.performanceScore,
          breakdown: {
            overall: scoreResult.overall,
            clickTrend: scoreResult.clickTrend,
            positionTrend: scoreResult.positionTrend,
            impressionTrend: scoreResult.impressionTrend,
            ctrBenchmark: scoreResult.ctrBenchmark,
            performanceScore: scoreResult.performanceScore,
            grade: scoreResult.grade,
          },
        },
      })

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        date: targetDate.toISOString(),
        score: scoreResult.overall,
        isUpdate: !!existingScore,
        seoScoreId: seoScore.id,
      }
    } catch (error) {
      console.error(`Score calculation failed for site ${siteId}:`, error)
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Can process multiple score calculations
    limiter: {
      max: 20,
      duration: 60000, // 1 minute
    },
  }
)

// Error handling
scoreWorker.on('failed', (job, error) => {
  console.error(`Score calculation job ${job?.id} failed:`, error)
})

scoreWorker.on('completed', (job, result) => {
  console.log(`Score calculation job ${job.id} completed:`, result)
})