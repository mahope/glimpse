import { google } from 'googleapis'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'gsc-client' })

export interface GSCMetric {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  pages?: string[]
}

export interface GSCPage {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  queries?: string[]
}

export interface GSCFilters {
  startDate: string
  endDate: string
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'searchAppearance')[]
  dimensionFilterGroups?: any[]
  rowLimit?: number
  startRow?: number
  aggregationType?: 'auto' | 'byProperty' | 'byPage'
}

export class GSCClient {
  private webmasters: any
  
  constructor(private refreshToken: string, private siteUrl: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_APP_URL + '/auth/callback/google'
    )
    
    auth.setCredentials({
      refresh_token: refreshToken
    })
    
    this.webmasters = google.webmasters({ version: 'v3', auth })
  }

  /**
   * Get basic site information and verification status
   */
  async getSiteInfo() {
    try {
      const response = await this.webmasters.sites.get({
        siteUrl: this.siteUrl
      })
      
      return {
        siteUrl: response.data.siteUrl,
        permissionLevel: response.data.permissionLevel,
        verified: response.data.verified || false
      }
    } catch (error) {
      log.error({ err: error }, 'Error fetching GSC site info')
      throw new Error('Failed to fetch site information from Google Search Console')
    }
  }

  /**
   * Get performance metrics for a date range
   */
  async getPerformanceMetrics(filters: GSCFilters): Promise<GSCMetric[]> {
    try {
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: filters.dimensions || ['date'],
          rowLimit: filters.rowLimit || 1000,
          startRow: filters.startRow || 0,
          aggregationType: filters.aggregationType || 'auto',
          dimensionFilterGroups: filters.dimensionFilterGroups || []
        }
      })

      const data = response.data.rows || []
      
      return data.map((row: any) => ({
        date: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      }))
    } catch (error) {
      log.error({ err: error }, 'Error fetching GSC performance metrics')
      throw new Error('Failed to fetch performance metrics from Google Search Console')
    }
  }

  /**
   * Get top queries with performance data
   */
  async getTopQueries(filters: Omit<GSCFilters, 'dimensions'>): Promise<GSCQuery[]> {
    try {
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: ['query'],
          rowLimit: filters.rowLimit || 50,
          startRow: filters.startRow || 0,
          aggregationType: filters.aggregationType || 'auto',
          dimensionFilterGroups: filters.dimensionFilterGroups || []
        }
      })

      const data = response.data.rows || []
      
      return data.map((row: any) => ({
        query: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      }))
    } catch (error) {
      log.error({ err: error }, 'Error fetching GSC top queries')
      throw new Error('Failed to fetch top queries from Google Search Console')
    }
  }

  /**
   * Get top pages with performance data
   */
  async getTopPages(filters: Omit<GSCFilters, 'dimensions'>): Promise<GSCPage[]> {
    try {
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: ['page'],
          rowLimit: filters.rowLimit || 50,
          startRow: filters.startRow || 0,
          aggregationType: filters.aggregationType || 'auto',
          dimensionFilterGroups: filters.dimensionFilterGroups || []
        }
      })

      const data = response.data.rows || []
      
      return data.map((row: any) => ({
        page: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      }))
    } catch (error) {
      log.error({ err: error }, 'Error fetching GSC top pages')
      throw new Error('Failed to fetch top pages from Google Search Console')
    }
  }

  /**
   * Get queries for a specific page
   */
  async getQueriesForPage(pageUrl: string, filters: Omit<GSCFilters, 'dimensions'>): Promise<GSCQuery[]> {
    try {
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: ['query'],
          rowLimit: filters.rowLimit || 50,
          startRow: filters.startRow || 0,
          aggregationType: filters.aggregationType || 'auto',
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'page',
                  operator: 'equals',
                  expression: pageUrl
                }
              ]
            }
          ]
        }
      })

      const data = response.data.rows || []
      
      return data.map((row: any) => ({
        query: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      }))
    } catch (error) {
      log.error({ err: error, pageUrl }, 'Error fetching queries for page')
      throw new Error('Failed to fetch queries for page from Google Search Console')
    }
  }

  /**
   * Get pages for a specific query
   */
  async getPagesForQuery(query: string, filters: Omit<GSCFilters, 'dimensions'>): Promise<GSCPage[]> {
    try {
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: ['page'],
          rowLimit: filters.rowLimit || 50,
          startRow: filters.startRow || 0,
          aggregationType: filters.aggregationType || 'auto',
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'query',
                  operator: 'equals',
                  expression: query
                }
              ]
            }
          ]
        }
      })

      const data = response.data.rows || []
      
      return data.map((row: any) => ({
        page: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      }))
    } catch (error) {
      log.error({ err: error, query }, 'Error fetching pages for query')
      throw new Error('Failed to fetch pages for query from Google Search Console')
    }
  }

  /**
   * Get performance data by device (mobile, desktop, tablet)
   */
  async getPerformanceByDevice(filters: Omit<GSCFilters, 'dimensions'>): Promise<Array<{device: string} & GSCMetric>> {
    try {
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: ['device'],
          rowLimit: filters.rowLimit || 10,
          startRow: filters.startRow || 0,
          aggregationType: filters.aggregationType || 'auto',
          dimensionFilterGroups: filters.dimensionFilterGroups || []
        }
      })

      const data = response.data.rows || []
      
      return data.map((row: any) => ({
        device: row.keys[0],
        date: '', // Not applicable for device breakdown
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      }))
    } catch (error) {
      log.error({ err: error }, 'Error fetching GSC performance by device')
      throw new Error('Failed to fetch performance by device from Google Search Console')
    }
  }

  /**
   * Get performance data by country
   */
  async getPerformanceByCountry(filters: Omit<GSCFilters, 'dimensions'>): Promise<Array<{country: string} & GSCMetric>> {
    try {
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: ['country'],
          rowLimit: filters.rowLimit || 20,
          startRow: filters.startRow || 0,
          aggregationType: filters.aggregationType || 'auto',
          dimensionFilterGroups: filters.dimensionFilterGroups || []
        }
      })

      const data = response.data.rows || []
      
      return data.map((row: any) => ({
        country: row.keys[0],
        date: '', // Not applicable for country breakdown
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0
      }))
    } catch (error) {
      log.error({ err: error }, 'Error fetching GSC performance by country')
      throw new Error('Failed to fetch performance by country from Google Search Console')
    }
  }
}

/**
 * Helper function to create date range filters
 */
export function createDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - days)
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

/**
 * Helper function to format GSC date format
 */
export function formatGSCDate(date: Date): string {
  return date.toISOString().split('T')[0]
}