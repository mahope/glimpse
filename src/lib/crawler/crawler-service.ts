import { prisma } from '@/lib/db'
import { WebCrawler, CrawlResult, SEOIssue, categorizeIssues } from './crawler'
import { PageAnalyzer } from './analyzer'

export class CrawlerService {
  /**
   * Crawl a site and store results in database
   */
  static async crawlAndStoreSite(siteId: string) {
    try {
      // Get site information
      const site = await prisma.site.findUnique({
        where: { id: siteId }
      })

      if (!site) {
        throw new Error(`Site not found: ${siteId}`)
      }

      console.log(`Starting crawl for ${site.domain}...`)

      // Initialize crawler
      const crawler = new WebCrawler({
        maxDepth: 2,
        maxPages: 25,
        delay: 1000, // 1 second between requests
        timeout: 15000 // 15 seconds timeout
      })

      // Crawl the site
      const crawlResults = await crawler.crawlSite(site.url, {
        maxDepth: 2,
        maxPages: 25,
        respectRobotsTxt: true
      })

      console.log(`Crawled ${crawlResults.length} pages for ${site.domain}`)

      // Store results in database
      const crawlDate = new Date()
      let storedResultsCount = 0

      for (const result of crawlResults) {
        // Store main crawl result in new schema format
        const crawlResultRecord = await prisma.crawlResult.create({
          data: {
            siteId,
            crawlDate,
            url: result.url,
            statusCode: result.statusCode,
            loadTimeMs: result.loadTime,
            title: result.title,
            metaDescription: result.metaDescription,
            h1Count: result.h1Tags.length,
            h2Count: result.h2Tags.length,
            totalImages: result.images.length,
            imagesWithoutAlt: result.images.filter(img => !img.hasAlt).length,
            wordCount: result.wordCount,
            contentLength: result.contentLength,
            totalLinks: result.links.length,
            internalLinks: result.links.filter(link => link.isInternal).length,
            externalLinks: result.links.filter(link => !link.isInternal).length,
            brokenLinks: 0, // Would need actual link checking
            issues: result.issues
          }
        })

        storedResultsCount++
      }

      console.log(`Stored ${storedResultsCount} crawl results for ${site.domain}`)

      // Calculate and store overall site health metrics
      await this.calculateSiteHealthMetrics(siteId, crawlDate, crawlResults)

      return {
        success: true,
        pagesProcessed: crawlResults.length,
        resultsStored: storedResultsCount
      }

    } catch (error) {
      console.error(`Error crawling site ${siteId}:`, error)
      throw error
    }
  }

  /**
   * Calculate and store overall site health metrics
   */
  static async calculateSiteHealthMetrics(siteId: string, crawlDate: Date, crawlResults: CrawlResult[]) {
    const totalPages = crawlResults.length
    if (totalPages === 0) return

    // Aggregate statistics
    const stats = {
      totalPages,
      pagesWithErrors: crawlResults.filter(r => r.statusCode >= 400).length,
      pagesWithSlowLoading: crawlResults.filter(r => r.loadTime > 3000).length,
      pagesWithoutTitle: crawlResults.filter(r => !r.title || r.title.length === 0).length,
      pagesWithoutMetaDescription: crawlResults.filter(r => !r.metaDescription || r.metaDescription.length === 0).length,
      pagesWithoutH1: crawlResults.filter(r => r.h1Tags.length === 0).length,
      pagesWithMultipleH1: crawlResults.filter(r => r.h1Tags.length > 1).length,
      totalImagesWithoutAlt: crawlResults.reduce((sum, r) => sum + r.images.filter(img => !img.hasAlt).length, 0),
      averageLoadTime: crawlResults.reduce((sum, r) => sum + r.loadTime, 0) / totalPages,
      averageWordCount: crawlResults.reduce((sum, r) => sum + (r.wordCount || 0), 0) / totalPages
    }

    // Count issues by category and severity
    const allIssues = crawlResults.flatMap(r => r.issues)
    const issueCounts = categorizeIssues(allIssues)

    // Calculate overall score (0-100)
    let overallScore = 100

    // Deduct points for various issues
    overallScore -= (stats.pagesWithErrors / totalPages) * 20 // 20% penalty for error pages
    overallScore -= (stats.pagesWithoutTitle / totalPages) * 15 // 15% penalty for missing titles
    overallScore -= (stats.pagesWithoutH1 / totalPages) * 10 // 10% penalty for missing H1
    overallScore -= (stats.pagesWithSlowLoading / totalPages) * 10 // 10% penalty for slow pages
    overallScore -= Math.min((issueCounts.errors.count / totalPages) * 10, 20) // Up to 20% for errors
    overallScore -= Math.min((issueCounts.warnings.count / totalPages) * 5, 15) // Up to 15% for warnings

    overallScore = Math.max(0, Math.round(overallScore))

    // Store site health summary
    await prisma.crawlResult.create({
      data: {
        siteId,
        crawlDate,
        url: `SUMMARY:${siteId}:${crawlDate.toISOString()}`, // Special identifier for summary records
        statusCode: 200,
        title: `Site Health Summary - ${totalPages} pages analyzed`,
        metaDescription: `Overall score: ${overallScore}/100`,
        h1Count: 0,
        imagesWithoutAlt: stats.totalImagesWithoutAlt,
        loadTimeMs: Math.round(stats.averageLoadTime),
        wordCount: Math.round(stats.averageWordCount),
        contentLength: 0,
        issues: JSON.stringify({
          summary: true,
          overallScore,
          stats,
          issueCounts,
          recommendations: this.generateRecommendations(stats, overallScore)
        })
      }
    })

    console.log(`Site health calculated for ${siteId}: Score ${overallScore}/100`)
    return { overallScore, stats, issueCounts }
  }

  /**
   * Generate recommendations based on site statistics
   */
  static generateRecommendations(stats: any, overallScore: number): string[] {
    const recommendations: string[] = []

    if (overallScore < 50) {
      recommendations.push('Critical: Site has major SEO issues that need immediate attention')
    } else if (overallScore < 75) {
      recommendations.push('Site has several SEO improvements opportunities')
    }

    if (stats.pagesWithErrors > 0) {
      recommendations.push(`Fix ${stats.pagesWithErrors} pages returning error status codes`)
    }

    if (stats.pagesWithoutTitle > 0) {
      recommendations.push(`Add title tags to ${stats.pagesWithoutTitle} pages`)
    }

    if (stats.pagesWithoutMetaDescription > stats.totalPages * 0.5) {
      recommendations.push('Add meta descriptions to improve click-through rates from search results')
    }

    if (stats.pagesWithoutH1 > 0) {
      recommendations.push(`Add H1 headings to ${stats.pagesWithoutH1} pages for better content structure`)
    }

    if (stats.averageLoadTime > 3000) {
      recommendations.push('Optimize page loading speed - average load time is over 3 seconds')
    }

    if (stats.totalImagesWithoutAlt > 10) {
      recommendations.push(`Add alt text to ${stats.totalImagesWithoutAlt} images for better accessibility`)
    }

    if (stats.averageWordCount < 300) {
      recommendations.push('Consider adding more content to pages - average word count is quite low')
    }

    return recommendations
  }

  /**
   * Get latest crawl results for a site
   */
  static async getLatestCrawlResults(siteId: string, limit: number = 10) {
    const results = await prisma.crawlResult.findMany({
      where: {
        siteId,
        url: { not: { contains: 'SUMMARY:' } } // Exclude summary records
      },
      orderBy: { crawlDate: 'desc' },
      take: limit
    })

    return results.map(result => ({
      ...result,
      issues: typeof result.issues === 'string' ? JSON.parse(result.issues) : result.issues
    }))
  }

  /**
   * Get latest site health summary
   */
  static async getLatestSiteHealthSummary(siteId: string) {
    const summary = await prisma.crawlResult.findFirst({
      where: {
        siteId,
        url: { contains: 'SUMMARY:' }
      },
      orderBy: { crawlDate: 'desc' }
    })

    if (!summary) return null

    const issues = typeof summary.issues === 'string' ? JSON.parse(summary.issues) : summary.issues

    return {
      crawlDate: summary.crawlDate,
      overallScore: issues.overallScore,
      stats: issues.stats,
      issueCounts: issues.issueCounts,
      recommendations: issues.recommendations
    }
  }

  /**
   * Get crawl history for a site (health scores over time)
   */
  static async getCrawlHistory(siteId: string, limit: number = 30) {
    const summaries = await prisma.crawlResult.findMany({
      where: {
        siteId,
        url: { contains: 'SUMMARY:' }
      },
      orderBy: { crawlDate: 'desc' },
      take: limit
    })

    return summaries.map(summary => {
      const issues = typeof summary.issues === 'string' ? JSON.parse(summary.issues) : summary.issues
      return {
        date: summary.crawlDate.toISOString().split('T')[0],
        score: issues.overallScore || 0,
        pagesAnalyzed: issues.stats?.totalPages || 0,
        errorCount: issues.issueCounts?.errors?.count || 0,
        warningCount: issues.issueCounts?.warnings?.count || 0
      }
    }).reverse() // Return in chronological order
  }

  /**
   * Get issues by category for dashboard
   */
  static async getIssuesByCategory(siteId: string) {
    const latestSummary = await this.getLatestSiteHealthSummary(siteId)
    
    if (!latestSummary) {
      return {
        title: { errors: 0, warnings: 0, info: 0 },
        description: { errors: 0, warnings: 0, info: 0 },
        headings: { errors: 0, warnings: 0, info: 0 },
        images: { errors: 0, warnings: 0, info: 0 },
        content: { errors: 0, warnings: 0, info: 0 },
        performance: { errors: 0, warnings: 0, info: 0 },
        links: { errors: 0, warnings: 0, info: 0 }
      }
    }

    // Get latest individual crawl results to analyze issue distribution
    const recentResults = await this.getLatestCrawlResults(siteId, 50)
    const allIssues = recentResults.flatMap(result => result.issues as SEOIssue[])

    // Group by category
    const categories = ['title', 'description', 'headings', 'images', 'content', 'performance', 'links']
    const issueSummary: Record<string, { errors: number; warnings: number; info: number }> = {}

    for (const category of categories) {
      const categoryIssues = allIssues.filter(issue => issue.category === category)
      issueSummary[category] = {
        errors: categoryIssues.filter(issue => issue.type === 'error').length,
        warnings: categoryIssues.filter(issue => issue.type === 'warning').length,
        info: categoryIssues.filter(issue => issue.type === 'info').length
      }
    }

    return issueSummary
  }
}

/**
 * Background job to crawl all active sites
 */
export async function crawlAllSites() {
  try {
    const sites = await prisma.site.findMany({
      where: { isActive: true }
    })

    console.log(`Starting crawl for ${sites.length} sites...`)

    const results = []

    for (const site of sites) {
      try {
        const result = await CrawlerService.crawlAndStoreSite(site.id)
        results.push({ siteId: site.id, domain: site.domain, ...result })
      } catch (error) {
        console.error(`Failed to crawl ${site.domain}:`, error)
        results.push({
          siteId: site.id,
          domain: site.domain,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('Crawling completed:', results)
    return results

  } catch (error) {
    console.error('Error in crawlAllSites:', error)
    throw error
  }
}