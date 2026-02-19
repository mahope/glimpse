import { prisma } from '@/lib/db'
import { GSCClient, GSCMetric, GSCQuery, GSCPage, createDateRange } from './gsc-client'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'gsc-service' })

export class GSCService {
  /**
   * Sync GSC data for a site
   */
  static async syncSiteData(siteId: string, days: number = 7) {
    try {
      // Get site with GSC credentials
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: { organization: true }
      })

      if (!site) {
        throw new Error(`Site not found: ${siteId}`)
      }

      if (!site.gscRefreshToken || !site.gscPropertyUrl) {
        throw new Error(`GSC not connected for site: ${site.domain}`)
      }

      // Decrypt the refresh token
      const refreshToken = await this.decryptToken(site.gscRefreshToken)
      
      // Initialize GSC client
      const gscClient = new GSCClient(refreshToken, site.gscPropertyUrl)

      // Create date range
      const dateRange = createDateRange(days)
      
      // Sync performance metrics by date
      const metrics = await gscClient.getPerformanceMetrics({
        ...dateRange,
        dimensions: ['date'],
        rowLimit: 1000
      })

      // Store metrics data
      for (const metric of metrics) {
        await prisma.searchConsoleData.upsert({
          where: {
            siteId_date_query_page_country_device: {
              siteId,
              date: new Date(metric.date),
              query: '',
              page: '',
              country: 'all',
              device: 'all'
            }
          },
          update: {
            clicks: metric.clicks,
            impressions: metric.impressions,
            ctr: metric.ctr,
            position: metric.position,
          },
          create: {
            siteId,
            date: new Date(metric.date),
            query: '',
            page: '',
            clicks: metric.clicks,
            impressions: metric.impressions,
            ctr: metric.ctr,
            position: metric.position,
            country: 'all',
            device: 'all'
          }
        })
      }

      // Sync top queries
      const topQueries = await gscClient.getTopQueries({
        ...dateRange,
        rowLimit: 100
      })

      for (const queryData of topQueries) {
        await prisma.searchConsoleData.upsert({
          where: {
            siteId_date_query_page_country_device: {
              siteId,
              date: new Date(dateRange.endDate),
              query: queryData.query,
              page: '',
              country: 'all',
              device: 'all'
            }
          },
          update: {
            clicks: queryData.clicks,
            impressions: queryData.impressions,
            ctr: queryData.ctr,
            position: queryData.position,
          },
          create: {
            siteId,
            date: new Date(dateRange.endDate),
            query: queryData.query,
            page: '',
            clicks: queryData.clicks,
            impressions: queryData.impressions,
            ctr: queryData.ctr,
            position: queryData.position,
            country: 'all',
            device: 'all'
          }
        })
      }

      // Sync top pages
      const topPages = await gscClient.getTopPages({
        ...dateRange,
        rowLimit: 100
      })

      for (const pageData of topPages) {
        await prisma.searchConsoleData.upsert({
          where: {
            siteId_date_query_page_country_device: {
              siteId,
              date: new Date(dateRange.endDate),
              query: '',
              page: pageData.page,
              country: 'all',
              device: 'all'
            }
          },
          update: {
            clicks: pageData.clicks,
            impressions: pageData.impressions,
            ctr: pageData.ctr,
            position: pageData.position,
          },
          create: {
            siteId,
            date: new Date(dateRange.endDate),
            query: '',
            page: pageData.page,
            clicks: pageData.clicks,
            impressions: pageData.impressions,
            ctr: pageData.ctr,
            position: pageData.position,
            country: 'all',
            device: 'all'
          }
        })
      }

      // Update last sync time
      await prisma.site.update({
        where: { id: siteId },
        data: { lastSyncedAt: new Date() }
      })

      log.info({ siteId, domain: site.domain, metrics: metrics.length, queries: topQueries.length, pages: topPages.length }, 'GSC data synced')
      
      return {
        success: true,
        metricsCount: metrics.length,
        queriesCount: topQueries.length,
        pagesCount: topPages.length
      }

    } catch (error) {
      log.error({ siteId, err: error }, 'Error syncing GSC data')
      throw error
    }
  }

  /**
   * Get aggregated metrics for a site and date range
   */
  static async getAggregatedMetrics(siteId: string, startDate: Date, endDate: Date) {
    const data = await prisma.searchConsoleData.findMany({
      where: {
        siteId,
        date: {
          gte: startDate,
          lte: endDate
        },
        query: '',
        page: '',
        country: 'all',
        device: 'all'
      },
      orderBy: { date: 'asc' }
    })

    return data.map(item => ({
      date: item.date.toISOString().split('T')[0],
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.ctr,
      position: item.position
    }))
  }

  /**
   * Get top queries for a site
   */
  static async getTopQueries(siteId: string, startDate: Date, endDate: Date, limit: number = 10) {
    const data = await prisma.searchConsoleData.findMany({
      where: {
        siteId,
        date: {
          gte: startDate,
          lte: endDate
        },
        query: { not: '' },
        page: '',
        country: 'all',
        device: 'all'
      },
      orderBy: { clicks: 'desc' },
      take: limit
    })

    return data.map(item => ({
      query: item.query,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.ctr,
      position: item.position
    }))
  }

  /**
   * Get top pages for a site
   */
  static async getTopPages(siteId: string, startDate: Date, endDate: Date, limit: number = 10) {
    const data = await prisma.searchConsoleData.findMany({
      where: {
        siteId,
        date: {
          gte: startDate,
          lte: endDate
        },
        query: '',
        page: { not: '' },
        country: 'all',
        device: 'all'
      },
      orderBy: { clicks: 'desc' },
      take: limit
    })

    return data.map(item => ({
      page: item.page,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.ctr,
      position: item.position
    }))
  }

  /**
   * Get performance comparison between two date ranges
   */
  static async getPerformanceComparison(
    siteId: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    previousPeriodStart: Date,
    previousPeriodEnd: Date
  ) {
    // Current period data
    const currentData = await this.getAggregatedMetrics(siteId, currentPeriodStart, currentPeriodEnd)
    const currentTotals = currentData.reduce(
      (acc, day) => ({
        clicks: acc.clicks + day.clicks,
        impressions: acc.impressions + day.impressions,
        ctr: 0, // Will calculate below
        position: 0 // Will calculate below
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    )
    
    // Calculate weighted averages
    currentTotals.ctr = currentTotals.impressions > 0 ? (currentTotals.clicks / currentTotals.impressions) * 100 : 0
    currentTotals.position = currentData.length > 0 
      ? currentData.reduce((acc, day) => acc + day.position, 0) / currentData.length 
      : 0

    // Previous period data
    const previousData = await this.getAggregatedMetrics(siteId, previousPeriodStart, previousPeriodEnd)
    const previousTotals = previousData.reduce(
      (acc, day) => ({
        clicks: acc.clicks + day.clicks,
        impressions: acc.impressions + day.impressions,
        ctr: 0,
        position: 0
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    )

    previousTotals.ctr = previousTotals.impressions > 0 ? (previousTotals.clicks / previousTotals.impressions) * 100 : 0
    previousTotals.position = previousData.length > 0 
      ? previousData.reduce((acc, day) => acc + day.position, 0) / previousData.length 
      : 0

    // Calculate changes
    const changes = {
      clicks: this.calculatePercentageChange(previousTotals.clicks, currentTotals.clicks),
      impressions: this.calculatePercentageChange(previousTotals.impressions, currentTotals.impressions),
      ctr: this.calculatePercentageChange(previousTotals.ctr, currentTotals.ctr),
      position: this.calculatePercentageChange(previousTotals.position, currentTotals.position)
    }

    return {
      current: currentTotals,
      previous: previousTotals,
      changes
    }
  }

  /**
   * Calculate percentage change between two values
   */
  private static calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0
    }
    return ((newValue - oldValue) / oldValue) * 100
  }

  /**
   * Placeholder for token decryption - implement with your encryption method
   */
  private static async decryptToken(encryptedToken: string): Promise<string> {
    const { decrypt } = await import('@/lib/crypto')
    try {
      return decrypt(encryptedToken)
    } catch (e) {
      log.warn({ err: e }, 'Failed to decrypt GSC token, falling back to raw value in dev')
      return encryptedToken
    }
  }

  /**
   * Encrypt token for storage
   */
  static async encryptToken(token: string): Promise<string> {
    const { encrypt } = await import('@/lib/crypto')
    return encrypt(token)
  }
}

/**
 * Background job to sync GSC data for all active sites
 */
export async function syncAllSites() {
  try {
    const sites = await prisma.site.findMany({
      where: {
        isActive: true,
        gscRefreshToken: { not: null },
        gscPropertyUrl: { not: null }
      }
    })

    log.info({ siteCount: sites.length }, 'Starting GSC sync for all sites')

    const results = []
    
    for (const site of sites) {
      try {
        const result = await GSCService.syncSiteData(site.id)
        results.push({ siteId: site.id, domain: site.domain, ...result })
      } catch (error) {
        log.error({ siteId: site.id, domain: site.domain, err: error }, 'Failed to sync GSC data')
        results.push({ 
          siteId: site.id, 
          domain: site.domain, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    log.info({ results }, 'GSC sync completed')
    return results

  } catch (error) {
    log.error({ err: error }, 'Error in syncAllSites')
    throw error
  }
}