import { Worker, Job } from 'bullmq'
import { redisConnection, PerformanceTestJobData } from '../queue'
import { runPageSpeedTest } from '@/lib/performance/pagespeed-client'
import { prisma } from '@/lib/db'

export const performanceWorker = new Worker<PerformanceTestJobData>(
  'performance-test',
  async (job: Job<PerformanceTestJobData>) => {
    const { siteId, organizationId, url, device } = job.data

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

      // Create pending performance test record
      const performanceTest = await prisma.performanceTest.create({
        data: {
          siteId,
          testUrl: url,
          device,
          status: 'RUNNING',
        },
      })

      await job.updateProgress(50)

      // Run the PageSpeed test
      const testResult = await runPageSpeedTest(url, {
        device: device.toLowerCase() as 'mobile' | 'desktop',
        categories: ['performance', 'accessibility', 'best-practices', 'seo'],
      })

      await job.updateProgress(80)

      // Update the performance test record with results
      const updatedTest = await prisma.performanceTest.update({
        where: { id: performanceTest.id },
        data: {
          status: 'COMPLETED',
          score: testResult.score,
          lcp: testResult.metrics.lcp,
          inp: testResult.metrics.inp,
          cls: testResult.metrics.cls,
          ttfb: testResult.metrics.ttfb,
          fcp: testResult.metrics.fcp,
          speedIndex: testResult.metrics.speedIndex,
          lighthouseVersion: testResult.lighthouseVersion,
          testDuration: testResult.testDuration,
          updatedAt: new Date(),
        },
      })

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        device,
        score: testResult.score,
        performanceTestId: updatedTest.id,
      }
    } catch (error) {
      console.error(`Performance test failed for site ${siteId}:`, error)
      
      // Mark test as failed if we have a test record
      try {
        await prisma.performanceTest.updateMany({
          where: {
            siteId,
            testUrl: url,
            device,
            status: 'RUNNING',
          },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date(),
          },
        })
      } catch (updateError) {
        console.error('Failed to update test status:', updateError)
      }

      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 2, // Limit concurrency due to PageSpeed API limits
    limiter: {
      max: 5, // Conservative limit for PageSpeed API
      duration: 60000, // 1 minute
    },
  }
)

// Error handling
performanceWorker.on('failed', (job, error) => {
  console.error(`Performance test job ${job?.id} failed:`, error)
})

performanceWorker.on('completed', (job, result) => {
  console.log(`Performance test job ${job.id} completed:`, result)
})