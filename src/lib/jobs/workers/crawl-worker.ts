import { Worker, Job } from 'bullmq'
import { redisConnection, SiteCrawlJobData } from '../queue'
import { prisma } from '@/lib/db'
import { WebCrawler, categorizeIssues } from '@/lib/crawler/crawler'
import { jobLogger } from '@/lib/logger'

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

      // Configure crawler
      const crawler = new WebCrawler({ userAgent: 'Glimpse SEO Crawler/1.0', timeout: 15000, followRedirects: true })

      await job.updateProgress(50)

      // Start the crawl
      const startedAt = new Date()
      const report = await prisma.crawlReport.create({ data: { siteId, startedAt, pagesCrawled: 0 } })

      const results = await crawler.crawlSite(url, { maxPages, respectRobotsTxt: true, delay: 1000 })

      // Persist page-level results (existing table)
      const crawlDate = new Date()
      for (const r of results) {
        await prisma.crawlResult.create({
          data: {
            siteId,
            crawlDate,
            url: r.url,
            statusCode: r.statusCode,
            loadTimeMs: r.loadTime,
            title: r.title,
            metaDescription: r.metaDescription,
            h1Count: r.h1Tags.length,
            h2Count: r.h2Tags.length,
            totalImages: r.images.length,
            imagesWithoutAlt: r.images.filter(i=>!i.hasAlt).length,
            wordCount: r.wordCount,
            contentLength: r.contentLength,
            totalLinks: r.links.length,
            internalLinks: r.links.filter(l=>l.isInternal).length,
            externalLinks: r.links.filter(l=>!l.isInternal).length,
            brokenLinks: 0,
            issues: r.issues,
          }
        })
      }

      // Aggregate totals and breakdown
      const allIssues = results.flatMap(r=>r.issues)
      const breakdown = categorizeIssues(allIssues)
      const totals = {
        pages: results.length,
        errors: breakdown.errors.count,
        warnings: breakdown.warnings.count,
        info: breakdown.info.count,
      }
      const topIssues = Object.values(['title','description','headings','images','links','content','performance']).flatMap(()=>[])
      // simple top issues by message
      const msgMap: Record<string,{count:number,type:string,category:string}> = {}
      for (const issue of allIssues) {
        const key = `${issue.category}:${issue.message}`
        msgMap[key] = msgMap[key] || { count:0, type: issue.type, category: issue.category }
        msgMap[key].count++
      }
      const top = Object.entries(msgMap).sort((a,b)=>b[1].count-a[1].count).slice(0,10).map(([k,v])=>({
        key: k,
        count: v.count,
        type: v.type,
        category: v.category,
      }))

      await prisma.crawlReport.update({
        where: { id: report.id },
        data: {
          finishedAt: new Date(),
          pagesCrawled: results.length,
          totals,
          issueBreakdown: breakdown,
          topIssues: top,
          summary: `${results.length} pages crawled. ${totals.errors} critical, ${totals.warnings} warnings, ${totals.info} info.`
        }
      })

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        url,
        pagesScanned: results.length,
        issuesFound: allIssues.length,
      }
    } catch (error) {
      const log = jobLogger('site-crawl', job.id, { siteId })
      log.error({ siteId, err: error }, 'Site crawl failed')
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
  const log = jobLogger('site-crawl', job?.id)
  log.error({ err: error }, 'Site crawl job failed')
})

crawlWorker.on('completed', (job, result) => {
  const log = jobLogger('site-crawl', job.id)
  log.info({ result }, 'Site crawl job completed')
})