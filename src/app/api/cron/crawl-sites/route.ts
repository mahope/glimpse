import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { CrawlerService } from "@/lib/crawler/crawler-service"
import { SEOCalculator } from "@/lib/scoring/calculator"

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log('Starting weekly site crawl job...')

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

    console.log(`Found ${sites.length} active sites to crawl`)

    const results = []
    let successCount = 0
    let errorCount = 0

    // Process sites in batches to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < sites.length; i += batchSize) {
      const batch = sites.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (site) => {
        try {
          console.log(`Crawling ${site.domain}...`)
          
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
            console.log(`Skipping ${site.domain} - crawled recently`)
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
          
          console.log(`Successfully crawled ${site.domain}: ${crawlResult.pagesProcessed} pages`)

          // Calculate SEO score after crawl
          try {
            const seoScore = await SEOCalculator.calculateSEOScore(site.id)
            console.log(`SEO score for ${site.domain}: ${seoScore.overall}/100 (${seoScore.grade})`)
          } catch (scoreError) {
            console.error(`Error calculating SEO score for ${site.domain}:`, scoreError)
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
          console.error(`Error crawling ${site.domain}:`, error)
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
          console.error(`Batch error for ${site.domain}:`, result.reason)
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
        console.log(`Waiting 30 seconds before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }

    console.log(`Crawl job completed: ${successCount} successful, ${errorCount} errors`)

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
    console.error('Error in crawl cron job:', error)
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
    // Check for admin authorization
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET || 'dev-secret'
    
    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Trigger the same logic as POST
    return POST(request)

  } catch (error) {
    console.error('Error in manual crawl trigger:', error)
    return NextResponse.json(
      { error: "Failed to trigger crawl job" },
      { status: 500 }
    )
  }
}