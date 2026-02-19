import { prisma } from '@/lib/db'

export interface SEOScoreComponents {
  clickTrend: number      // 25% weight
  positionTrend: number   // 25% weight  
  impressionTrend: number // 20% weight
  ctrBenchmark: number    // 15% weight
  performanceScore: number // 15% weight
}

export interface SEOScoreBreakdown extends SEOScoreComponents {
  overall: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  improvements: string[]
  strengths: string[]
}

export interface TrendData {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
}

export class SEOCalculator {
  
  /**
   * Calculate comprehensive SEO score according to PRD model
   * - Click trend (25%)
   * - Position trend (25%)
   * - Impression trend (20%)
   * - CTR vs benchmark (15%)
   * - Performance score (15%)
   */
  static async calculateSEOScore(siteId: string): Promise<SEOScoreBreakdown> {
    try {
      const [clickTrend, positionTrend, impressionTrend, ctrBenchmark, performanceScore] = await Promise.all([
        this.calculateClickTrend(siteId),
        this.calculatePositionTrend(siteId),
        this.calculateImpressionTrend(siteId),
        this.calculateCTRBenchmark(siteId),
        this.calculatePerformanceScore(siteId)
      ])

      const components: SEOScoreComponents = {
        clickTrend: clickTrend.score,
        positionTrend: positionTrend.score,
        impressionTrend: impressionTrend.score,
        ctrBenchmark: ctrBenchmark.score,
        performanceScore: performanceScore.score
      }

      // Apply weights according to PRD
      const overall = Math.round(
        (components.clickTrend * 0.25) +
        (components.positionTrend * 0.25) +
        (components.impressionTrend * 0.20) +
        (components.ctrBenchmark * 0.15) +
        (components.performanceScore * 0.15)
      )

      const grade = this.getGrade(overall)

      // Collect insights
      const improvements: string[] = []
      const strengths: string[] = []

      if (clickTrend.score < 70) improvements.push(...clickTrend.improvements)
      else strengths.push(...clickTrend.strengths)

      if (positionTrend.score < 70) improvements.push(...positionTrend.improvements)
      else strengths.push(...positionTrend.strengths)

      if (impressionTrend.score < 70) improvements.push(...impressionTrend.improvements)
      else strengths.push(...impressionTrend.strengths)

      if (ctrBenchmark.score < 70) improvements.push(...ctrBenchmark.improvements)
      else strengths.push(...ctrBenchmark.strengths)

      if (performanceScore.score < 70) improvements.push(...performanceScore.improvements)
      else strengths.push(...performanceScore.strengths)

      // Store the score
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
   * Calculate click trend score (25% weight)
   * Compares last 30 days vs previous 30 days
   */
  private static async calculateClickTrend(siteId: string): Promise<{
    score: number
    trend: TrendData
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []

    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      // Get current period data (last 30 days)
      const currentData = await prisma.searchConsoleData.aggregate({
        where: {
          siteId,
          date: { gte: thirtyDaysAgo },
          query: '',
          page: '',
          country: 'all',
          device: 'all'
        },
        _sum: { clicks: true }
      })

      // Get previous period data (30-60 days ago)
      const previousData = await prisma.searchConsoleData.aggregate({
        where: {
          siteId,
          date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          query: '',
          page: '',
          country: 'all', 
          device: 'all'
        },
        _sum: { clicks: true }
      })

      const current = currentData._sum.clicks || 0
      const previous = previousData._sum.clicks || 0

      let change = current - previous
      let changePercent = previous > 0 ? (change / previous) * 100 : 0
      let trend: 'up' | 'down' | 'stable' = 'stable'

      if (changePercent > 5) trend = 'up'
      else if (changePercent < -5) trend = 'down'

      const trendData: TrendData = { current, previous, change, changePercent, trend }

      // Score based on trend
      let score = 50 // Base score

      if (trend === 'up') {
        if (changePercent >= 50) {
          score = 100
          strengths.push('Exceptional click growth (50%+ increase)')
        } else if (changePercent >= 25) {
          score = 85
          strengths.push('Strong click growth (25%+ increase)')
        } else if (changePercent >= 10) {
          score = 75
          strengths.push('Good click growth (10%+ increase)')
        } else {
          score = 65
          strengths.push('Positive click trend')
        }
      } else if (trend === 'down') {
        if (changePercent <= -50) {
          score = 0
          improvements.push('Critical: Clicks dropped by 50%+ - investigate immediately')
        } else if (changePercent <= -25) {
          score = 15
          improvements.push('Severe: Clicks dropped by 25%+ - needs urgent attention')
        } else if (changePercent <= -10) {
          score = 30
          improvements.push('Clicks declining - review content and rankings')
        } else {
          score = 45
          improvements.push('Slight decline in clicks - monitor and optimize')
        }
      } else {
        if (current === 0) {
          score = 20
          improvements.push('No organic clicks - focus on SEO fundamentals')
        } else if (current < 50) {
          score = 40
          improvements.push('Low click volume - improve rankings and CTR')
        } else {
          score = 55
          improvements.push('Stable clicks - focus on growth opportunities')
        }
      }

      return { score: Math.min(100, Math.max(0, score)), trend: trendData, improvements, strengths }

    } catch (error) {
      console.error('Error calculating click trend:', error)
      return {
        score: 0,
        trend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' },
        improvements: ['Unable to calculate click trend - check data connection'],
        strengths: []
      }
    }
  }

  /**
   * Calculate position trend score (25% weight)
   * Compares average position last 30 days vs previous 30 days
   */
  private static async calculatePositionTrend(siteId: string): Promise<{
    score: number
    trend: TrendData
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []

    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      // Get weighted average position for current period
      const currentData = await prisma.searchConsoleData.aggregate({
        where: {
          siteId,
          date: { gte: thirtyDaysAgo },
          impressions: { gt: 0 }
        },
        _avg: { position: true }
      })

      // Get weighted average position for previous period
      const previousData = await prisma.searchConsoleData.aggregate({
        where: {
          siteId,
          date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          impressions: { gt: 0 }
        },
        _avg: { position: true }
      })

      const current = currentData._avg.position || 50
      const previous = previousData._avg.position || 50

      // For position, lower is better, so we invert the change calculation
      const change = previous - current // Positive means improvement
      const changePercent = previous > 0 ? (change / previous) * 100 : 0
      let trend: 'up' | 'down' | 'stable' = 'stable'

      if (changePercent > 5) trend = 'up' // Improved positions
      else if (changePercent < -5) trend = 'down' // Worse positions

      const trendData: TrendData = { 
        current, 
        previous, 
        change, 
        changePercent, 
        trend 
      }

      // Score based on position trend and absolute position
      let score = 50

      // Base score from current position
      if (current <= 5) score = 90
      else if (current <= 10) score = 75
      else if (current <= 20) score = 60
      else if (current <= 50) score = 40
      else score = 20

      // Adjust based on trend
      if (trend === 'up') {
        score = Math.min(100, score + 20)
        if (changePercent >= 20) {
          strengths.push('Excellent position improvement (20%+ better)')
        } else if (changePercent >= 10) {
          strengths.push('Good position improvement (10%+ better)')
        } else {
          strengths.push('Positions trending upward')
        }
      } else if (trend === 'down') {
        score = Math.max(0, score - 30)
        if (changePercent <= -20) {
          improvements.push('Critical: Positions dropped significantly (20%+ worse)')
        } else if (changePercent <= -10) {
          improvements.push('Warning: Positions declining (10%+ worse)')
        } else {
          improvements.push('Positions slightly declining - monitor keywords')
        }
      } else {
        if (current <= 10) {
          strengths.push('Maintaining strong search positions')
        } else {
          improvements.push('Stable but low positions - focus on ranking improvements')
        }
      }

      return { score, trend: trendData, improvements, strengths }

    } catch (error) {
      console.error('Error calculating position trend:', error)
      return {
        score: 0,
        trend: { current: 50, previous: 50, change: 0, changePercent: 0, trend: 'stable' },
        improvements: ['Unable to calculate position trend - check data connection'],
        strengths: []
      }
    }
  }

  /**
   * Calculate impression trend score (20% weight)
   */
  private static async calculateImpressionTrend(siteId: string): Promise<{
    score: number
    trend: TrendData
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []

    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const currentData = await prisma.searchConsoleData.aggregate({
        where: {
          siteId,
          date: { gte: thirtyDaysAgo },
          query: '',
          page: '',
          country: 'all',
          device: 'all'
        },
        _sum: { impressions: true }
      })

      const previousData = await prisma.searchConsoleData.aggregate({
        where: {
          siteId,
          date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          query: '',
          page: '',
          country: 'all',
          device: 'all'
        },
        _sum: { impressions: true }
      })

      const current = currentData._sum.impressions || 0
      const previous = previousData._sum.impressions || 0

      const change = current - previous
      const changePercent = previous > 0 ? (change / previous) * 100 : 0
      let trend: 'up' | 'down' | 'stable' = 'stable'

      if (changePercent > 5) trend = 'up'
      else if (changePercent < -5) trend = 'down'

      const trendData: TrendData = { current, previous, change, changePercent, trend }

      let score = 50

      if (trend === 'up') {
        if (changePercent >= 30) {
          score = 95
          strengths.push('Exceptional impression growth (30%+ increase)')
        } else if (changePercent >= 15) {
          score = 80
          strengths.push('Strong impression growth (15%+ increase)')
        } else {
          score = 70
          strengths.push('Good impression growth')
        }
      } else if (trend === 'down') {
        if (changePercent <= -30) {
          score = 10
          improvements.push('Critical: Impressions dropped 30%+ - check indexing issues')
        } else if (changePercent <= -15) {
          score = 25
          improvements.push('Warning: Significant impression decline (15%+)')
        } else {
          score = 45
          improvements.push('Impressions declining - review content freshness')
        }
      } else {
        if (current === 0) {
          score = 15
          improvements.push('No search impressions - site may not be indexed properly')
        } else if (current < 1000) {
          score = 35
          improvements.push('Low impression volume - expand content and keywords')
        } else {
          score = 55
          improvements.push('Stable impressions - look for growth opportunities')
        }
      }

      return { score: Math.min(100, Math.max(0, score)), trend: trendData, improvements, strengths }

    } catch (error) {
      console.error('Error calculating impression trend:', error)
      return {
        score: 0,
        trend: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'stable' },
        improvements: ['Unable to calculate impression trend'],
        strengths: []
      }
    }
  }

  /**
   * Calculate CTR vs benchmark score (15% weight)
   */
  private static async calculateCTRBenchmark(siteId: string): Promise<{
    score: number
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []

    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const data = await prisma.searchConsoleData.aggregate({
        where: {
          siteId,
          date: { gte: thirtyDaysAgo },
          impressions: { gt: 0 }
        },
        _sum: {
          clicks: true,
          impressions: true
        }
      })

      const totalClicks = data._sum.clicks || 0
      const totalImpressions = data._sum.impressions || 0
      const currentCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

      // Industry benchmarks (approximate)
      const benchmarks = {
        excellent: 10, // 10%+ CTR
        good: 5,      // 5-10% CTR
        average: 2,   // 2-5% CTR
        poor: 1       // 1-2% CTR
      }

      let score = 0

      if (currentCTR >= benchmarks.excellent) {
        score = 100
        strengths.push(`Exceptional CTR (${currentCTR.toFixed(2)}%) - well above industry average`)
      } else if (currentCTR >= benchmarks.good) {
        score = 80
        strengths.push(`Strong CTR (${currentCTR.toFixed(2)}%) - above industry average`)
      } else if (currentCTR >= benchmarks.average) {
        score = 60
        improvements.push(`Average CTR (${currentCTR.toFixed(2)}%) - optimize titles and descriptions`)
      } else if (currentCTR >= benchmarks.poor) {
        score = 30
        improvements.push(`Low CTR (${currentCTR.toFixed(2)}%) - improve title and meta description appeal`)
      } else if (currentCTR > 0) {
        score = 15
        improvements.push(`Very low CTR (${currentCTR.toFixed(2)}%) - review search snippet optimization`)
      } else {
        score = 0
        improvements.push('No click-through data available')
      }

      return { score, improvements, strengths }

    } catch (error) {
      console.error('Error calculating CTR benchmark:', error)
      return {
        score: 0,
        improvements: ['Unable to calculate CTR benchmark'],
        strengths: []
      }
    }
  }

  /**
   * Calculate performance score (15% weight)
   */
  private static async calculatePerformanceScore(siteId: string): Promise<{
    score: number
    improvements: string[]
    strengths: string[]
  }> {
    const improvements: string[] = []
    const strengths: string[] = []

    try {
      // Prefer latest MOBILE PageSpeed snapshot if available
      const latestMobilePsi = await prisma.perfSnapshot.findFirst({
        where: { siteId, strategy: 'MOBILE' },
        orderBy: { date: 'desc' }
      })

      const performanceScore = latestMobilePsi?.perfScore ?? null

      if (performanceScore == null) {
        improvements.push('Run PageSpeed performance test to get score')
        return { score: 0, improvements, strengths }
      }

      if (performanceScore >= 90) {
        strengths.push(`Excellent performance score (${performanceScore}/100)`)
      } else if (performanceScore >= 70) {
        improvements.push(`Good performance (${performanceScore}/100) - optimize for excellence`)
      } else if (performanceScore >= 50) {
        improvements.push(`Moderate performance (${performanceScore}/100) - needs optimization`)
      } else {
        improvements.push(`Poor performance (${performanceScore}/100) - critical speed issues`)
      }

      return { score: performanceScore, improvements, strengths }

    } catch (error) {
      console.error('Error calculating performance score:', error)
      return {
        score: 0,
        improvements: ['Unable to calculate performance score'],
        strengths: []
      }
    }
  }

  /**
   * Convert overall score to letter grade
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
   * Store calculated SEO score in database
   */
  static async storeSEOScore(siteId: string, components: SEOScoreComponents, overall: number, date?: Date) {
    const targetDate = date ?? new Date()
    await prisma.seoScore.upsert({
      where: {
        siteId_date: { siteId, date: targetDate }
      },
      update: {
        score: overall,
        clickTrend: components.clickTrend,
        positionTrend: components.positionTrend,
        impressionTrend: components.impressionTrend,
        ctrBenchmark: components.ctrBenchmark,
        performanceScore: components.performanceScore,
        breakdown: {
          clickTrend: components.clickTrend,
          positionTrend: components.positionTrend,
          impressionTrend: components.impressionTrend,
          ctrBenchmark: components.ctrBenchmark,
          performanceScore: components.performanceScore,
          overall
        }
      },
      create: {
        siteId,
        date: targetDate,
        score: overall,
        clickTrend: components.clickTrend,
        positionTrend: components.positionTrend,
        impressionTrend: components.impressionTrend,
        ctrBenchmark: components.ctrBenchmark,
        performanceScore: components.performanceScore,
        breakdown: {
          clickTrend: components.clickTrend,
          positionTrend: components.positionTrend,
          impressionTrend: components.impressionTrend,
          ctrBenchmark: components.ctrBenchmark,
          performanceScore: components.performanceScore,
          overall
        }
      }
    })
  }

  /**
   * Get SEO score history for charts
   */
  static async getScoreHistory(siteId: string, days: number = 90): Promise<any[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const scores = await prisma.seoScore.findMany({
      where: {
        siteId,
        date: { gte: startDate }
      },
      orderBy: { date: 'asc' }
    })

    return scores.map(score => ({
      date: score.date.toISOString().split('T')[0],
      overall: score.score,
      clickTrend: score.clickTrend,
      positionTrend: score.positionTrend,
      impressionTrend: score.impressionTrend,
      ctrBenchmark: score.ctrBenchmark,
      performanceScore: score.performanceScore
    }))
  }
}