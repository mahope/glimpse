import { Worker, Job } from 'bullmq'
import { redisConnection, SiteCrawlJobData } from '../queue'
import { crawlSite } from '@/lib/crawler/crawler-service'
import { prisma } from '@/lib/db'

export const crawlWorker = new Worker<SiteCrawlJobData>(
  'site-crawl',
  async (job: Job<SiteCrawlJobData>) => {
    const { siteId, organizationId, url, maxPages = 50 } = job.data

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

      // Configure crawl options
      const crawlOptions = {
        maxPages,
        respectRobotsTxt: true,
        checkSSL: true,
        checkMetaTags: true,
        checkHeadings: true,
        checkImages: true,
        checkLinks: true,
        userAgent: 'SEO-Tracker-Bot/1.0',
        delay: 1000, // 1 second delay between requests
      }

      await job.updateProgress(50)

      // Start the crawl
      const crawlResult = await crawlSite(url, crawlOptions)

      await job.updateProgress(90)

      // Store crawl results in database
      // Note: You might want to create a separate table for crawl results
      // For now, we'll just log the results and potentially store key insights
      console.log(`Crawl completed for ${url}:`, {
        pagesScanned: crawlResult.pagesScanned,
        issuesFound: crawlResult.issues.length,
        recommendations: crawlResult.recommendations.length,
      })

      // You could create a CrawlReport table to store these results
      // await prisma.crawlReport.create({
      //   data: {
      //     siteId,
      //     url,
      //     pagesScanned: crawlResult.pagesScanned,
      //     issues: crawlResult.issues,
      //     recommendations: crawlResult.recommendations,
      //     // ... other fields
      //   }
      // })

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        url,
        pagesScanned: crawlResult.pagesScanned,
        issuesFound: crawlResult.issues.length,
        recommendations: crawlResult.recommendations.length,
      }
    } catch (error) {
      console.error(`Site crawl failed for site ${siteId}:`, error)
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Only one crawl at a time to be respectful
    limiter: {
      max: 2, // Very conservative for crawling
      duration: 300000, // 5 minutes
    },
  }
)

// Error handling
crawlWorker.on('failed', (job, error) => {
  console.error(`Site crawl job ${job?.id} failed:`, error)
})

crawlWorker.on('completed', (job, result) => {
  console.log(`Site crawl job ${job.id} completed:`, result)
})