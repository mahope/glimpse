import { Worker, Job } from 'bullmq'
import { redisConnection, GSCSyncJobData } from '../queue'
import { fetchAndStoreGSCDaily } from '@/lib/gsc/fetch-daily'
import { decrypt } from '@/lib/crypto'
import { prisma } from '@/lib/db'

export const gscSyncWorker = new Worker<GSCSyncJobData>(
  'gsc-sync',
  async (job: Job<GSCSyncJobData>) => {
    const { siteId, organizationId } = job.data

    try {
      await job.updateProgress(10)

      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          organizationId,
          isActive: true,
          gscRefreshToken: { not: null },
        },
      })

      if (!site || !site.gscPropertyUrl) {
        throw new Error(`Site ${siteId} not found or GSC not connected`)
      }

      await job.updateProgress(25)

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - 30)

      await job.updateProgress(50)

      const result = await fetchAndStoreGSCDaily({
        siteId,
        propertyUrl: site.gscPropertyUrl,
        refreshToken: site.gscRefreshToken ? decrypt(site.gscRefreshToken) : undefined,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        mock: process.env.MOCK_GSC === 'true',
      })

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        records: result.records,
        mocked: result.mocked,
        timeRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      }
    } catch (error) {
      console.error(`GSC sync failed for site ${siteId}:`, error)
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
)

gscSyncWorker.on('failed', (job, error) => {
  console.error(`GSC sync job ${job?.id} failed:`, error)
})

gscSyncWorker.on('completed', (job, result) => {
  console.log(`GSC sync job ${job.id} completed:`, result)
})
