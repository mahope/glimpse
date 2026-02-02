/**
 * Google APIs Client Wrapper for Search Console
 * Handles authentication and API calls with proper error handling
 */

import { google, Auth } from 'googleapis'
import { 
  GSCSearchAnalyticsQuery, 
  GSCApiResponse, 
  GSCRow, 
  GSCSitemapsListResponse,
  GSCError,
  GSCAuthError,
  GSCQuotaError,
  GSCValidationError
} from './types'

export interface GSCClientConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken: string
  quotaUser?: string
}

export class GoogleApisClient {
  private auth: Auth.OAuth2Client
  private webmasters: any
  
  constructor(private config: GSCClientConfig) {
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    )
    
    this.auth.setCredentials({
      refresh_token: config.refreshToken
    })
    
    this.webmasters = google.webmasters({
      version: 'v3',
      auth: this.auth
    })
  }

  /**
   * Refresh access token if needed
   */
  private async ensureValidToken(): Promise<void> {
    try {
      const { token } = await this.auth.getAccessToken()
      if (!token) {
        throw new GSCAuthError('Failed to refresh access token')
      }
    } catch (error) {
      throw new GSCAuthError('Token refresh failed', error)
    }
  }

  /**
   * Handle API errors and convert to typed errors
   */
  private handleApiError(error: any): never {
    if (error.code === 401 || error.code === 403) {
      throw new GSCAuthError(error.message || 'Authentication failed', error)
    }
    
    if (error.code === 429 || error.message?.includes('quota')) {
      throw new GSCQuotaError(
        error.message || 'Quota exceeded',
        this.config.quotaUser
      )
    }
    
    if (error.code === 400) {
      throw new GSCValidationError(error.message || 'Invalid request parameters')
    }
    
    throw new GSCError(error.message || 'API request failed', error.code, error)
  }

  /**
   * List sites available in Search Console
   */
  async listSites(): Promise<string[]> {
    try {
      await this.ensureValidToken()
      
      const response = await this.webmasters.sites.list({
        quotaUser: this.config.quotaUser
      })
      
      return response.data.siteEntry?.map((site: any) => site.siteUrl) || []
    } catch (error) {
      this.handleApiError(error)
    }
  }

  /**
   * Get Search Analytics data
   */
  async getSearchAnalytics(
    siteUrl: string, 
    query: GSCSearchAnalyticsQuery
  ): Promise<GSCApiResponse<GSCRow>> {
    try {
      await this.ensureValidToken()
      
      // Validate query parameters
      this.validateSearchAnalyticsQuery(query)
      
      const response = await this.webmasters.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: query,
        quotaUser: this.config.quotaUser
      })
      
      return response.data || { rows: [] }
    } catch (error) {
      this.handleApiError(error)
    }
  }

  /**
   * Get Search Analytics data with automatic pagination
   */
  async getSearchAnalyticsPaginated(
    siteUrl: string,
    query: GSCSearchAnalyticsQuery,
    options: {
      maxRows?: number
      onProgress?: (processed: number, total?: number) => void
    } = {}
  ): Promise<GSCRow[]> {
    const { maxRows = 25000, onProgress } = options
    const rowLimit = Math.min(query.rowLimit || 1000, 1000) // GSC limit per request
    
    let allRows: GSCRow[] = []
    let startRow = query.startRow || 0
    let hasMore = true
    
    while (hasMore && allRows.length < maxRows) {
      const currentQuery: GSCSearchAnalyticsQuery = {
        ...query,
        rowLimit,
        startRow
      }
      
      const response = await this.getSearchAnalytics(siteUrl, currentQuery)
      const rows = response.rows || []
      
      if (rows.length === 0) {
        hasMore = false
        break
      }
      
      allRows.push(...rows)
      startRow += rowLimit
      
      // Call progress callback
      onProgress?.(allRows.length)
      
      // Check if we got fewer rows than requested (indicates last page)
      if (rows.length < rowLimit) {
        hasMore = false
      }
      
      // Rate limiting - wait between requests
      await this.delay(100)
    }
    
    return allRows.slice(0, maxRows)
  }

  /**
   * Get sitemaps for a site
   */
  async listSitemaps(siteUrl: string): Promise<GSCSitemapsListResponse> {
    try {
      await this.ensureValidToken()
      
      const response = await this.webmasters.sitemaps.list({
        siteUrl: siteUrl,
        quotaUser: this.config.quotaUser
      })
      
      return response.data || {}
    } catch (error) {
      this.handleApiError(error)
    }
  }

  /**
   * Submit a sitemap
   */
  async submitSitemap(siteUrl: string, feedpath: string): Promise<void> {
    try {
      await this.ensureValidToken()
      
      await this.webmasters.sitemaps.submit({
        siteUrl: siteUrl,
        feedpath: feedpath,
        quotaUser: this.config.quotaUser
      })
    } catch (error) {
      this.handleApiError(error)
    }
  }

  /**
   * Delete a sitemap
   */
  async deleteSitemap(siteUrl: string, feedpath: string): Promise<void> {
    try {
      await this.ensureValidToken()
      
      await this.webmasters.sitemaps.delete({
        siteUrl: siteUrl,
        feedpath: feedpath,
        quotaUser: this.config.quotaUser
      })
    } catch (error) {
      this.handleApiError(error)
    }
  }

  /**
   * Test authentication by making a simple API call
   */
  async testAuthentication(): Promise<boolean> {
    try {
      await this.listSites()
      return true
    } catch (error) {
      if (error instanceof GSCAuthError) {
        return false
      }
      throw error
    }
  }

  /**
   * Get detailed site information
   */
  async getSiteInfo(siteUrl: string): Promise<any> {
    try {
      await this.ensureValidToken()
      
      const response = await this.webmasters.sites.get({
        siteUrl: siteUrl,
        quotaUser: this.config.quotaUser
      })
      
      return response.data
    } catch (error) {
      this.handleApiError(error)
    }
  }

  /**
   * Validate search analytics query parameters
   */
  private validateSearchAnalyticsQuery(query: GSCSearchAnalyticsQuery): void {
    const { startDate, endDate, rowLimit, startRow } = query
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new GSCValidationError('Dates must be in YYYY-MM-DD format')
    }
    
    // Validate date range
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) {
      throw new GSCValidationError('Start date must be before or equal to end date')
    }
    
    // Validate row limit
    if (rowLimit && (rowLimit < 1 || rowLimit > 25000)) {
      throw new GSCValidationError('Row limit must be between 1 and 25,000')
    }
    
    // Validate start row
    if (startRow && startRow < 0) {
      throw new GSCValidationError('Start row must be non-negative')
    }
  }

  /**
   * Helper method for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current quota usage (approximate)
   */
  getQuotaUser(): string | undefined {
    return this.config.quotaUser
  }

  /**
   * Create a new client with different quota user
   */
  withQuotaUser(quotaUser: string): GoogleApisClient {
    return new GoogleApisClient({
      ...this.config,
      quotaUser
    })
  }

  /**
   * Batch multiple requests with rate limiting
   */
  async batchRequests<T>(
    requests: Array<() => Promise<T>>,
    options: {
      concurrency?: number
      delayBetweenBatches?: number
    } = {}
  ): Promise<Array<T | Error>> {
    const { concurrency = 3, delayBetweenBatches = 1000 } = options
    const results: Array<T | Error> = []
    
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency)
      
      const batchResults = await Promise.allSettled(
        batch.map(request => request())
      )
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push(result.reason)
        }
      }
      
      // Delay between batches to respect rate limits
      if (i + concurrency < requests.length) {
        await this.delay(delayBetweenBatches)
      }
    }
    
    return results
  }
}

/**
 * Factory function to create a client instance
 */
export function createGoogleApisClient(config: GSCClientConfig): GoogleApisClient {
  return new GoogleApisClient(config)
}

/**
 * Create client from environment variables
 */
export function createGoogleApisClientFromEnv(refreshToken: string): GoogleApisClient {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL + '/auth/callback/google'
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured')
  }
  
  return createGoogleApisClient({
    clientId,
    clientSecret,
    redirectUri,
    refreshToken
  })
}