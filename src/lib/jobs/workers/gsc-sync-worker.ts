import { Worker, Job } from 'bullmq'
import { redisConnection, GSCSyncJobData } from '../queue'
import { syncSiteGSCData } from '@/lib/gsc/sync'
import { prisma } from '@/lib/db'

export const gscSyncWorker = new Worker<GSCSyncJobData>(
  'gsc-sync',
  async (job: Job<GSCSyncJobData>) => {
    const { siteId, organizationId } = job.data

    try {
      // Update job progress
      await job.updateProgress(10)

      // Fetch site with GSC credentials
      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          organizationId: organizationId, // Multi-tenant safety
          isActive: true,
          gscRefreshToken: { not: null },
        },
      })

      if (!site) {
        throw new Error(`Site ${siteId} not found or GSC not connected`)
      }

      await job.updateProgress(25)

      // Sync last 30 days of data
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - 30)

      await job.updateProgress(50)

      // Perform the actual sync
      const result = await syncSiteGSCData(site, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query', 'page', 'country', 'device'],
      })

      await job.updateProgress(90)

      // Update site's last sync timestamp
      await prisma.site.update({
        where: { id: siteId },
        data: { updatedAt: new Date() },
      })

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        recordsProcessed: result.recordsProcessed,
        timeRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      }
    } catch (error) {
      console.error(`GSC sync failed for site ${siteId}:`, error)
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 sites concurrently
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 60000, // 1 minute (respects GSC API limits)
    },
  }
)

// Error handling
gscSyncWorker.on('failed', (job, error) => {
  console.error(`GSC sync job ${job?.id} failed:`, error)
})

gscSyncWorker.on('completed', (job, result) => {
  console.log(`GSC sync job ${job.id} completed:`, result)
})