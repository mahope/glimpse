import { prisma } from '@/lib/db'

export interface SEOScoreComponents {
  performance: number // 0-25 points (PageSpeed metrics)
  content: number     // 0-25 points (Content quality, structure)
  technical: number   // 0-25 points (Technical SEO issues)
  search: number      // 0-25 points (Search Console performance)
}

export interface SEOScoreBreakdown extends SEOScoreComponents {
  overall: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  improvements: string[]
  strengths: string[]
}

export interface ScoreHistory {
  date: string
  overall: number
  performance: number
  content: number
  technical: number
  search: number
}

export class SEOScoring {
  /**
   * Calculate comprehensive SEO score for a site
   */
  static async calculateSEOScore(siteId: string): Promise<SEOScoreBreakdown> {
    try {
      // Get latest data from all sources
      const [performanceScore, contentScore, technicalScore, searchScore] = await Promise.all([
        this.calculatePerformanceScore(siteId),
        this.calculateContentScore(siteId),
        this.calculateTechnicalScore(siteId),
        this.calculateSearchScore(siteId)
      ])

      const components: SEOScoreComponents = {
        performance: performanceScore.score,
        content: contentScore.score,
        technical: technicalScore.score,
        search: searchScore.score
      }

      const overall = Math.round(
        (components.performance + components.content + components.technical + components.search)
      )

      const grade = this.getGrade(overall)

      // Collect improvements and strengths
      const improvements = [
        ...performanceScore.improvements,
        ...contentScore.improvements,
        ...technicalScore.improvements,
        ...searchScore.improvements
      ]

      const strengths = [
        ...performanceScore.strengths,
        ...contentScore.strengths,
        ...technicalScore.strengths,
        ...searchScore.strengths
      ]

      // Store the score in database
      await this.storeSEOScore(siteId, components, overall)

      return {
        ...components,
        overall,
        grade,
        improvements,
        strengths
      }

    } catch (error) {
      console.error(`Error calculating SEO score for site ${siteId}:`, error)
      throw error
    }
  }

  /**
   * Calculate performance score (0-25 points) based on Core Web Vitals and PageSpeed
   */
  static async calculatePerformanceScore(siteId: string): Promise<{
    score: number
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []
    let score = 0

    try {
      // Get latest performance test results
      const latestPerformanceTest = await prisma.performanceTest.findFirst({
        where: { siteId },
        orderBy: { testedAt: 'desc' }
      })

      if (!latestPerformanceTest) {
        improvements.push('Run PageSpeed Insights test to get performance data')
        return { score: 0, improvements, strengths }
      }

      // Performance Score (0-10 points)
      const performanceScorePoints = (latestPerformanceTest.performanceScore / 100) * 10
      score += performanceScorePoints

      if (latestPerformanceTest.performanceScore >= 90) {
        strengths.push('Excellent PageSpeed performance score')
      } else if (latestPerformanceTest.performanceScore >= 70) {
        improvements.push('Good performance score - optimize further for excellence')
      } else {
        improvements.push('Performance score needs significant improvement')
      }

      // Core Web Vitals (15 points total: 5 for LCP, 5 for INP, 5 for CLS)
      
      // Largest Contentful Paint (LCP)
      if (latestPerformanceTest.lcpMs) {
        if (latestPerformanceTest.lcpMs <= 2500) {
          score += 5
          strengths.push('Excellent Largest Contentful Paint')
        } else if (latestPerformanceTest.lcpMs <= 4000) {
          score += 3
          improvements.push('LCP needs improvement - optimize largest element loading')
        } else {
          score += 1
          improvements.push('Poor LCP - critical loading speed issues')
        }
      }

      // Interaction to Next Paint (INP) or First Input Delay (FID)
      const interactionMetric = latestPerformanceTest.inpMs || latestPerformanceTest.fidMs
      if (interactionMetric) {
        if (interactionMetric <= 200) {
          score += 5
          strengths.push('Excellent page responsiveness')
        } else if (interactionMetric <= 500) {
          score += 3
          improvements.push('Page responsiveness could be better')
        } else {
          score += 1
          improvements.push('Poor page responsiveness - optimize JavaScript execution')
        }
      }

      // Cumulative Layout Shift (CLS)
      if (latestPerformanceTest.cls !== null && latestPerformanceTest.cls !== undefined) {
        if (latestPerformanceTest.cls <= 0.1) {
          score += 5
          strengths.push('Excellent visual stability')
        } else if (latestPerformanceTest.cls <= 0.25) {
          score += 3
          improvements.push('Some layout shift issues - stabilize visual elements')
        } else {
          score += 1
          improvements.push('Significant layout shift issues affecting user experience')
        }
      }

    } catch (error) {
      console.error('Error calculating performance score:', error)
      improvements.push('Unable to analyze performance data')
    }

    return { 
      score: Math.min(25, Math.round(score)), 
      improvements, 
      strengths 
    }
  }

  /**
   * Calculate content score (0-25 points) based on content quality and structure
   */
  static async calculateContentScore(siteId: string): Promise<{
    score: number
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []
    let score = 0

    try {
      // Get latest crawl results
      const latestCrawlResults = await prisma.crawlResult.findMany({
        where: {
          siteId,
          url: { not: { contains: 'SUMMARY:' } }
        },
        orderBy: { crawlDate: 'desc' },
        take: 50
      })

      if (latestCrawlResults.length === 0) {
        improvements.push('Run site crawl to analyze content quality')
        return { score: 0, improvements, strengths }
      }

      const totalPages = latestCrawlResults.length

      // Title tag analysis (5 points)
      const pagesWithTitles = latestCrawlResults.filter(page => page.title && page.title.length > 0)
      const titleScore = (pagesWithTitles.length / totalPages) * 5
      score += titleScore

      if (titleScore >= 4.5) {
        strengths.push('Most pages have title tags')
      } else {
        improvements.push(`${totalPages - pagesWithTitles.length} pages missing title tags`)
      }

      // Meta description analysis (5 points)
      const pagesWithDescriptions = latestCrawlResults.filter(page => 
        page.metaDescription && page.metaDescription.length > 0
      )
      const descriptionScore = (pagesWithDescriptions.length / totalPages) * 5
      score += descriptionScore

      if (descriptionScore >= 4) {
        strengths.push('Good meta description coverage')
      } else {
        improvements.push('Add meta descriptions to more pages')
      }

      // Heading structure analysis (5 points)
      const pagesWithH1 = latestCrawlResults.filter(page => page.h1Count > 0)
      const headingScore = (pagesWithH1.length / totalPages) * 5
      score += headingScore

      if (headingScore >= 4.5) {
        strengths.push('Good heading structure')
      } else {
        improvements.push('Add H1 headings to improve content structure')
      }

      // Content length analysis (5 points)
      const averageWordCount = latestCrawlResults.reduce((sum, page) => 
        sum + (page.wordCount || 0), 0
      ) / totalPages

      if (averageWordCount >= 500) {
        score += 5
        strengths.push('Good content depth with comprehensive text')
      } else if (averageWordCount >= 300) {
        score += 3
        improvements.push('Consider adding more detailed content')
      } else {
        score += 1
        improvements.push('Content is quite thin - add more valuable information')
      }

      // Image optimization (5 points)
      const totalImagesWithoutAlt = latestCrawlResults.reduce((sum, page) => 
        sum + page.imagesWithoutAlt, 0
      )
      const totalImages = totalImagesWithoutAlt + 100 // Rough estimate, could be improved

      if (totalImagesWithoutAlt === 0) {
        score += 5
        strengths.push('All images have alt text')
      } else if (totalImagesWithoutAlt < totalImages * 0.1) {
        score += 4
        strengths.push('Most images have alt text')
      } else {
        score += 2
        improvements.push(`${totalImagesWithoutAlt} images missing alt text`)
      }

    } catch (error) {
      console.error('Error calculating content score:', error)
      improvements.push('Unable to analyze content data')
    }

    return { 
      score: Math.min(25, Math.round(score)), 
      improvements, 
      strengths 
    }
  }

  /**
   * Calculate technical SEO score (0-25 points)
   */
  static async calculateTechnicalScore(siteId: string): Promise<{
    score: number
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []
    let score = 0

    try {
      // Get latest crawl results for technical analysis
      const latestCrawlResults = await prisma.crawlResult.findMany({
        where: {
          siteId,
          url: { not: { contains: 'SUMMARY:' } }
        },
        orderBy: { crawlDate: 'desc' },
        take: 50
      })

      if (latestCrawlResults.length === 0) {
        improvements.push('Run site crawl to analyze technical SEO')
        return { score: 0, improvements, strengths }
      }

      const totalPages = latestCrawlResults.length

      // HTTP status codes (10 points)
      const successfulPages = latestCrawlResults.filter(page => 
        page.statusCode >= 200 && page.statusCode < 400
      )
      const statusScore = (successfulPages.length / totalPages) * 10
      score += statusScore

      const errorPages = latestCrawlResults.filter(page => page.statusCode >= 400)
      if (errorPages.length === 0) {
        strengths.push('No HTTP errors found')
      } else {
        improvements.push(`Fix ${errorPages.length} pages with HTTP errors`)
      }

      // Page speed (5 points)
      const averageLoadTime = latestCrawlResults.reduce((sum, page) => 
        sum + page.loadTimeMs, 0
      ) / totalPages

      if (averageLoadTime <= 2000) {
        score += 5
        strengths.push('Fast average page loading speed')
      } else if (averageLoadTime <= 3000) {
        score += 3
        improvements.push('Page loading speed is moderate - optimize for better performance')
      } else {
        score += 1
        improvements.push('Slow page loading speed - needs optimization')
      }

      // Content accessibility (5 points)
      const accessibilityScore = this.calculateAccessibilityScore(latestCrawlResults)
      score += accessibilityScore.score

      if (accessibilityScore.score >= 4) {
        strengths.push('Good content accessibility')
      } else {
        improvements.push(...accessibilityScore.issues)
      }

      // Mobile-friendliness (5 points)
      // For now, assume mobile-friendly if we have performance data
      // This could be enhanced with actual mobile testing
      const performanceTest = await prisma.performanceTest.findFirst({
        where: { 
          siteId, 
          device: 'MOBILE' 
        },
        orderBy: { testedAt: 'desc' }
      })

      if (performanceTest) {
        if (performanceTest.performanceScore >= 70) {
          score += 5
          strengths.push('Good mobile performance')
        } else {
          score += 2
          improvements.push('Mobile performance needs improvement')
        }
      } else {
        improvements.push('Test mobile performance')
      }

    } catch (error) {
      console.error('Error calculating technical score:', error)
      improvements.push('Unable to analyze technical SEO data')
    }

    return { 
      score: Math.min(25, Math.round(score)), 
      improvements, 
      strengths 
    }
  }

  /**
   * Calculate search performance score (0-25 points) based on GSC data
   */
  static async calculateSearchScore(siteId: string): Promise<{
    score: number
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []
    let score = 0

    try {
      // Get recent GSC data (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const gscData = await prisma.searchConsoleData.findMany({
        where: {
          siteId,
          date: { gte: thirtyDaysAgo },
          query: '',
          page: '',
          country: 'all',
          device: 'all'
        },
        orderBy: { date: 'asc' }
      })

      if (gscData.length === 0) {
        improvements.push('Connect Google Search Console to track search performance')
        return { score: 0, improvements, strengths }
      }

      // Calculate totals
      const totalClicks = gscData.reduce((sum, day) => sum + day.clicks, 0)
      const totalImpressions = gscData.reduce((sum, day) => sum + day.impressions, 0)
      const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
      const averagePosition = gscData.length > 0 
        ? gscData.reduce((sum, day) => sum + day.position, 0) / gscData.length 
        : 0

      // Click volume scoring (5 points)
      if (totalClicks >= 1000) {
        score += 5
        strengths.push('Strong organic click volume')
      } else if (totalClicks >= 100) {
        score += 3
        improvements.push('Growing organic traffic - optimize to increase further')
      } else if (totalClicks > 0) {
        score += 1
        improvements.push('Low organic traffic - focus on content optimization and keyword targeting')
      }

      // Impression volume scoring (5 points)
      if (totalImpressions >= 10000) {
        score += 5
        strengths.push('High search visibility')
      } else if (totalImpressions >= 1000) {
        score += 3
        improvements.push('Good search visibility - work on improving rankings')
      } else if (totalImpressions > 0) {
        score += 1
        improvements.push('Low search visibility - improve content relevance and SEO')
      }

      // Click-through rate scoring (5 points)
      if (averageCTR >= 10) {
        score += 5
        strengths.push('Excellent click-through rate from search results')
      } else if (averageCTR >= 5) {
        score += 3
        improvements.push('Good CTR - optimize titles and descriptions for better click-through')
      } else if (averageCTR > 0) {
        score += 1
        improvements.push('Low CTR - improve title tags and meta descriptions')
      }

      // Average position scoring (10 points)
      if (averagePosition <= 5) {
        score += 10
        strengths.push('Excellent average search position')
      } else if (averagePosition <= 10) {
        score += 7
        strengths.push('Good average search position')
      } else if (averagePosition <= 20) {
        score += 4
        improvements.push('Moderate search rankings - optimize content and build authority')
      } else if (averagePosition > 0) {
        score += 1
        improvements.push('Low search rankings - focus on SEO fundamentals and content quality')
      }

      // Trend analysis
      if (gscData.length >= 7) {
        const recentWeek = gscData.slice(-7)
        const previousWeek = gscData.slice(-14, -7)
        
        if (previousWeek.length > 0) {
          const recentClicks = recentWeek.reduce((sum, day) => sum + day.clicks, 0)
          const previousClicks = previousWeek.reduce((sum, day) => sum + day.clicks, 0)
          
          if (recentClicks > previousClicks) {
            strengths.push('Organic traffic is trending upward')
          } else if (recentClicks < previousClicks * 0.9) {
            improvements.push('Organic traffic is declining - investigate and optimize')
          }
        }
      }

    } catch (error) {
      console.error('Error calculating search score:', error)
      improvements.push('Unable to analyze search performance data')
    }

    return { 
      score: Math.min(25, Math.round(score)), 
      improvements, 
      strengths 
    }
  }

  /**
   * Calculate accessibility score from crawl results
   */
  private static calculateAccessibilityScore(crawlResults: any[]): { score: number; issues: string[] } {
    const issues: string[] = []
    const totalPages = crawlResults.length
    let score = 0

    // Images without alt text
    const totalImagesWithoutAlt = crawlResults.reduce((sum, page) => sum + page.imagesWithoutAlt, 0)
    if (totalImagesWithoutAlt === 0) {
      score += 2.5
    } else {
      issues.push(`${totalImagesWithoutAlt} images missing alt text`)
    }

    // Heading structure (H1 presence)
    const pagesWithH1 = crawlResults.filter(page => page.h1Count > 0).length
    if (pagesWithH1 === totalPages) {
      score += 2.5
    } else {
      issues.push(`${totalPages - pagesWithH1} pages missing H1 headings`)
    }

    return { score, issues }
  }

  /**
   * Convert score to letter grade
   */
  private static getGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'A+'
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  /**
   * Store SEO score in database
   */
  private static async storeSEOScore(siteId: string, components: SEOScoreComponents, overall: number) {
    await prisma.seoScore.create({
      data: {
        siteId,
        date: new Date(),
        overallScore: overall,
        performanceScore: components.performance,
        components: {
          performance: components.performance,
          content: components.content,
          technical: components.technical,
          search: components.search
        }
      }
    })
  }

  /**
   * Get SEO score history for a site
   */
  static async getScoreHistory(siteId: string, days: number = 30): Promise<ScoreHistory[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const scores = await prisma.seoScore.findMany({
      where: {
        siteId,
        date: { gte: startDate }
      },
      orderBy: { date: 'asc' }
    })

    return scores.map(score => {
      const components = score.components as any
      return {
        date: score.date.toISOString().split('T')[0],
        overall: score.overallScore,
        performance: components.performance || 0,
        content: components.content || 0,
        technical: components.technical || 0,
        search: components.search || 0
      }
    })
  }

  /**
   * Get latest SEO score for a site
   */
  static async getLatestScore(siteId: string): Promise<SEOScoreBreakdown | null> {
    const latestScore = await prisma.seoScore.findFirst({
      where: { siteId },
      orderBy: { date: 'desc' }
    })

    if (!latestScore) return null

    const components = latestScore.components as any
    
    return {
      performance: components.performance || 0,
      content: components.content || 0,
      technical: components.technical || 0,
      search: components.search || 0,
      overall: latestScore.overallScore,
      grade: this.getGrade(latestScore.overallScore),
      improvements: [], // Would need to recalculate or store separately
      strengths: []
    }
  }
}

/**
 * Background job to calculate SEO scores for all active sites
 */
export async function calculateAllSiteScores() {
  try {
    const sites = await prisma.site.findMany({
      where: { isActive: true }
    })

    console.log(`Calculating SEO scores for ${sites.length} sites...`)

    const results = []

    for (const site of sites) {
      try {
        const score = await SEOScoring.calculateSEOScore(site.id)
        results.push({
          siteId: site.id,
          domain: site.domain,
          success: true,
          score: score.overall,
          grade: score.grade
        })
        console.log(`${site.domain}: ${score.overall}/100 (${score.grade})`)
      } catch (error) {
        console.error(`Failed to calculate score for ${site.domain}:`, error)
        results.push({
          siteId: site.id,
          domain: site.domain,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('SEO score calculation completed:', results)
    return results

  } catch (error) {
    console.error('Error in calculateAllSiteScores:', error)
    throw error
  }
}