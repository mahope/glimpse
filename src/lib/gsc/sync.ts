/**
 * @deprecated Use `@/lib/gsc/fetch-daily` (`fetchAndStoreGSCDaily`) instead.
 * This legacy service writes to the SearchConsoleData table which is no longer
 * the canonical data source. The canonical pipeline writes to SearchStatDaily.
 * Kept only for reference; no active code imports this module.
 */

import { PrismaClient } from '@prisma/client'
import { createGoogleApisClientFromEnv, GoogleApisClient } from './client'
import {
  GSCSearchAnalyticsQuery,
  GSCSyncJob,
  GSCSyncResult,
  GSCSyncConfig,
  GSCDimension,
  GSCRow,
  ProcessedGSCData,
  GSCError
} from './types'
import { Redis } from 'ioredis'

export interface SyncServiceConfig {
  prisma: PrismaClient
  redis?: Redis
  batchSize?: number
  maxRetries?: number
  retryDelayMs?: number
}

export class GSCDataSyncService {
  constructor(
    private config: SyncServiceConfig,
    private gscClient?: GoogleApisClient
  ) {}

  /**
   * Sync data for a specific site
   */
  async syncSiteData(
    siteId: string,
    options: {
      startDate?: string
      endDate?: string
      dimensions?: GSCDimension[]
      forceResync?: boolean
    } = {}
  ): Promise<GSCSyncResult> {
    const startTime = Date.now()
    let recordsProcessed = 0
    let recordsInserted = 0
    let recordsUpdated = 0
    const errors: string[] = []

    try {
      // Get site and sync configuration
      const site = await this.config.prisma.site.findUnique({
        where: { id: siteId }
      })

      if (!site) {
        throw new Error(`Site not found: ${siteId}`)
      }

      if (!site.gscTokens) {
        throw new Error(`Site ${siteId} does not have GSC tokens configured`)
      }

      // Initialize GSC client with site tokens
      const client = this.getGSCClient(site.gscTokens)
      
      // Set up sync parameters
      const {
        startDate = this.getDefaultStartDate(site.lastSyncedAt, options.forceResync),
        endDate = this.getYesterday(),
        dimensions = ['query', 'page', 'country', 'device']
      } = options

      // Create sync job record
      const syncJob = await this.createSyncJob(siteId, startDate, endDate, dimensions)

      try {
        // Update job status
        await this.updateSyncJob(syncJob.id, { status: 'running' })

        // Perform sync for each dimension combination
        const results = await this.syncDimensions(
          client,
          site.gscPropertyUrl,
          siteId,
          startDate,
          endDate,
          dimensions
        )

        recordsProcessed = results.recordsProcessed
        recordsInserted = results.recordsInserted
        recordsUpdated = results.recordsUpdated
        errors.push(...results.errors)

        // Update site's last synced timestamp
        await this.config.prisma.site.update({
          where: { id: siteId },
          data: { lastSyncedAt: new Date() }
        })

        // Complete sync job
        await this.updateSyncJob(syncJob.id, {
          status: 'completed',
          recordsProcessed,
          recordsInserted,
          recordsUpdated,
          errors,
          completedAt: new Date()
        })

        // Invalidate cache
        await this.invalidateCache(siteId)

        return {
          success: errors.length === 0,
          recordsProcessed,
          recordsInserted,
          recordsUpdated,
          errors,
          duration: Date.now() - startTime
        }

      } catch (error) {
        // Mark sync job as failed
        await this.updateSyncJob(syncJob.id, {
          status: 'failed',
          errors: [...errors, error instanceof Error ? error.message : String(error)],
          completedAt: new Date()
        })
        throw error
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      return {
        success: false,
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        errors,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Sync data for all enabled sites
   */
  async syncAllSites(options: {
    maxConcurrency?: number
    skipErrors?: boolean
  } = {}): Promise<Record<string, GSCSyncResult>> {
    const { maxConcurrency = 3, skipErrors = true } = options

    // Get all sites with GSC enabled
    const sites = await this.config.prisma.site.findMany({
      where: {
        gscTokens: {
          not: null
        }
      }
    })

    const results: Record<string, GSCSyncResult> = {}
    const semaphore = new Semaphore(maxConcurrency)

    const syncPromises = sites.map(site => 
      semaphore.acquire().then(async (release) => {
        try {
          const result = await this.syncSiteData(site.id)
          results[site.id] = result
        } catch (error) {
          results[site.id] = {
            success: false,
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            errors: [error instanceof Error ? error.message : String(error)],
            duration: 0
          }
          
          if (!skipErrors) {
            throw error
          }
        } finally {
          release()
        }
      })
    )

    await Promise.all(syncPromises)
    return results
  }

  /**
   * Sync data for specific dimensions
   */
  private async syncDimensions(
    client: GoogleApisClient,
    siteUrl: string,
    siteId: string,
    startDate: string,
    endDate: string,
    dimensions: GSCDimension[]
  ): Promise<GSCSyncResult> {
    let recordsProcessed = 0
    let recordsInserted = 0
    let recordsUpdated = 0
    const errors: string[] = []

    try {
      // Query with all dimensions
      const query: GSCSearchAnalyticsQuery = {
        startDate,
        endDate,
        dimensions,
        aggregationType: 'byProperty',
        rowLimit: 25000
      }

      const rows = await client.getSearchAnalyticsPaginated(siteUrl, query, {
        onProgress: (processed) => {
          recordsProcessed = processed
        }
      })

      // Process rows in batches
      const batchSize = this.config.batchSize || 1000
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { inserted, updated } = await this.processBatch(siteId, batch, dimensions, startDate, endDate)
        recordsInserted += inserted
        recordsUpdated += updated
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsInserted,
      recordsUpdated,
      errors,
      duration: 0
    }
  }

  /**
   * Process a batch of GSC rows
   */
  private async processBatch(
    siteId: string,
    rows: GSCRow[],
    dimensions: GSCDimension[],
    startDate: string,
    endDate: string
  ): Promise<{ inserted: number; updated: number }> {
    let inserted = 0
    let updated = 0

    for (const row of rows) {
      try {
        const data = this.mapRowToDatabase(siteId, row, dimensions, startDate)
        
        // Use upsert to handle duplicates
        const result = await this.config.prisma.searchConsoleData.upsert({
          where: {
            siteId_date_query_page_country_device: {
              siteId: data.siteId,
              date: data.date,
              query: data.query,
              page: data.page,
              country: data.country,
              device: data.device
            }
          },
          update: {
            clicks: data.clicks,
            impressions: data.impressions,
            position: data.position,
            ctr: data.ctr
          },
          create: data
        })

        // Track if this was an insert or update
        if (result.createdAt.getTime() === new Date().getTime()) {
          inserted++
        } else {
          updated++
        }

      } catch (error) {
        console.error('Error processing row:', error, row)
      }
    }

    return { inserted, updated }
  }

  /**
   * Map GSC row to database structure
   */
  private mapRowToDatabase(
    siteId: string,
    row: GSCRow,
    dimensions: GSCDimension[],
    date: string
  ): Record<string, unknown> {
    const keys = row.keys || []
    const data: Record<string, unknown> = {
      siteId,
      date: new Date(date),
      query: 'all',
      page: 'all',
      country: 'all',
      device: 'all',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      position: row.position || 0,
      ctr: row.ctr || 0
    }

    // Map keys to dimensions
    dimensions.forEach((dimension, index) => {
      const value = keys[index] || 'all'
      switch (dimension) {
        case 'query':
          data.query = value
          break
        case 'page':
          data.page = value
          break
        case 'country':
          data.country = value
          break
        case 'device':
          data.device = value.toLowerCase()
          break
        case 'date':
          data.date = new Date(value)
          break
      }
    })

    return data
  }

  /**
   * Create sync job record
   */
  private async createSyncJob(
    siteId: string,
    startDate: string,
    endDate: string,
    dimensions: GSCDimension[]
  ): Promise<GSCSyncJob> {
    // For now, just return a mock job ID since we don't have a jobs table
    // In a real implementation, you'd create a database record
    return {
      id: `job_${Date.now()}`,
      siteId,
      status: 'pending',
      startDate,
      endDate,
      dimensions,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: [],
      startedAt: new Date()
    }
  }

  /**
   * Update sync job status
   */
  private async updateSyncJob(jobId: string, updates: Partial<GSCSyncJob>): Promise<void> {
    // Mock implementation - in real app, update database record
    console.log(`Updating job ${jobId}:`, updates)
  }

  /**
   * Get GSC client for site tokens
   */
  private getGSCClient(encryptedTokens: string): GoogleApisClient {
    if (this.gscClient) {
      return this.gscClient
    }

    // Decrypt tokens and create client
    const tokens = this.decryptTokens(encryptedTokens)
    return createGoogleApisClientFromEnv(tokens.refresh_token)
  }

  /**
   * Decrypt GSC tokens
   */
  private decryptTokens(encryptedTokens: string): { refresh_token: string } {
    // Implement token decryption here
    // For now, assume tokens are stored as JSON
    try {
      return JSON.parse(encryptedTokens)
    } catch {
      throw new Error('Failed to decrypt GSC tokens')
    }
  }

  /**
   * Get default start date for sync
   */
  private getDefaultStartDate(lastSyncedAt: Date | null, forceResync: boolean): string {
    if (forceResync) {
      // Sync last 30 days if forced
      const date = new Date()
      date.setDate(date.getDate() - 30)
      return date.toISOString().split('T')[0]
    }

    if (lastSyncedAt) {
      // Sync from last sync date
      return lastSyncedAt.toISOString().split('T')[0]
    }

    // Default to last 7 days for new sites
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  }

  /**
   * Get yesterday's date
   */
  private getYesterday(): string {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    return date.toISOString().split('T')[0]
  }

  /**
   * Invalidate cache for site
   */
  private async invalidateCache(siteId: string): Promise<void> {
    if (!this.config.redis) return

    const keys = [
      `site:${siteId}:overview`,
      `site:${siteId}:performance`,
      `site:${siteId}:queries`,
      `site:${siteId}:pages`
    ]

    await Promise.all(keys.map(key => this.config.redis!.del(key)))
  }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--
        resolve(() => this.release())
      } else {
        this.queue.push(() => {
          this.permits--
          resolve(() => this.release())
        })
      }
    })
  }

  private release(): void {
    this.permits++
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      next()
    }
  }
}

/**
 * Factory function to create sync service
 */
export function createGSCDataSyncService(config: SyncServiceConfig): GSCDataSyncService {
  return new GSCDataSyncService(config)
}

/**
 * Sync service with default configuration
 */
export function createDefaultGSCDataSyncService(
  prisma: PrismaClient,
  redis?: Redis
): GSCDataSyncService {
  return createGSCDataSyncService({
    prisma,
    redis,
    batchSize: 1000,
    maxRetries: 3,
    retryDelayMs: 5000
  })
}