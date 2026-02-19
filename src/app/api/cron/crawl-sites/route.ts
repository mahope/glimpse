import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { CrawlerService } from "@/lib/crawler/crawler-service"
import { SEOCalculator } from "@/lib/scoring/calculator"
import { verifyCronSecret } from '@/lib/cron/auth'
import { cronLogger } from '@/lib/logger'

const log = cronLogger('crawl-sites')

export async function POST(request: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(request)
    if (unauthorized) return unauthorized

    log.info('Starting weekly site crawl job')

    // Get all active sites
    const sites = await prisma.site.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        domain: true,
        url: true,
        updatedAt: true
      }
    })

    if (sites.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active sites to crawl"
      })
    }

    log.info({ siteCount: sites.length }, 'Found active sites to crawl')

    const results: Array<{ siteId: string; domain: string; success: boolean; skipped?: boolean; reason?: string; pagesProcessed?: number; resultsStored?: number; error?: string }> = []
    let successCount = 0
    let errorCount = 0

    // Process sites in batches to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < sites.length; i += batchSize) {
      const batch = sites.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (site) => {
        try {
          log.info({ domain: site.domain }, 'Crawling site')
          
          // Check if site was crawled recently (within last 6 days)
          const recentCrawl = await prisma.crawlResult.findFirst({
            where: {
              siteId: site.id,
              crawlDate: {
                gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
              }
            },
            orderBy: { crawlDate: 'desc' }
          })

          if (recentCrawl) {
            log.info({ domain: site.domain }, 'Skipping site - crawled recently')
            return {
              siteId: site.id,
              domain: site.domain,
              success: true,
              skipped: true,
              reason: 'Recently crawled'
            }
          }

          // Perform the crawl
          const crawlResult = await CrawlerService.crawlAndStoreSite(site.id)
          
          log.info({ domain: site.domain, pages: crawlResult.pagesProcessed }, 'Successfully crawled site')

          // Calculate SEO score after crawl
          try {
            const seoScore = await SEOCalculator.calculateSEOScore(site.id)
            log.info({ domain: site.domain, score: seoScore.overall, grade: seoScore.grade }, 'SEO score calculated')
          } catch (scoreError) {
            log.error({ domain: site.domain, err: scoreError }, 'Error calculating SEO score')
          }

          successCount++
          return {
            siteId: site.id,
            domain: site.domain,
            success: true,
            pagesProcessed: crawlResult.pagesProcessed,
            resultsStored: crawlResult.resultsStored
          }

        } catch (error) {
          log.error({ domain: site.domain, err: error }, 'Error crawling site')
          errorCount++
          return {
            siteId: site.id,
            domain: site.domain,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          const site = batch[index]
          log.error({ domain: site.domain, err: result.reason }, 'Batch error')
          results.push({
            siteId: site.id,
            domain: site.domain,
            success: false,
            error: 'Batch processing error'
          })
          errorCount++
        }
      })

      // Add delay between batches to be respectful
      if (i + batchSize < sites.length) {
        log.info('Waiting 30 seconds before next batch')
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }

    log.info({ successCount, errorCount }, 'Crawl job completed')

    // Store job summary
    const jobSummary = {
      timestamp: new Date().toISOString(),
      sitesProcessed: sites.length,
      successfulCrawls: successCount,
      errors: errorCount,
      duration: 'N/A', // Could track actual duration
      results: results.slice(0, 10) // Limit stored results
    }

    return NextResponse.json({
      success: true,
      message: `Crawl job completed successfully`,
      summary: jobSummary,
      results: results
    })

  } catch (error) {
    log.error({ err: error }, 'Error in crawl cron job')
    return NextResponse.json(
      {
        success: false,
        error: "Crawl job failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// Also allow GET for manual triggers (with proper auth)
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(request)
    if (unauthorized) return unauthorized

    // Trigger the same logic as POST
    return POST(request)

  } catch (error) {
    log.error({ err: error }, 'Error in manual crawl trigger')
    return NextResponse.json(
      { error: "Failed to trigger crawl job" },
      { status: 500 }
    )
  }
}