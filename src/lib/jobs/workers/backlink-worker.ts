import { Worker, Job } from 'bullmq'
import { redisConnection, BacklinkSyncJobData } from '../queue'
import { syncBacklinks } from '@/lib/backlinks/sync'
import { jobLogger } from '@/lib/logger'
import { moveToDeadLetter } from '../dead-letter'

export const backlinkWorker = new Worker<BacklinkSyncJobData>(
  'backlink-sync',
  async (job: Job<BacklinkSyncJobData>) => {
    const { siteId, organizationId } = job.data

    try {
      await job.updateProgress(10)

      const result = await syncBacklinks({ siteId, organizationId })

      await job.updateProgress(100)

      return {
        success: true,
        siteId,
        ...result,
      }
    } catch (error) {
      const log = jobLogger('backlink-sync', job.id, { siteId })
      log.error({ siteId, err: error }, 'Backlink sync failed')
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000,
    },
  }
)

backlinkWorker.on('failed', async (job, error) => {
  const log = jobLogger('backlink-sync', job?.id)
  log.error({ err: error }, 'Backlink sync job failed')
  await moveToDeadLetter(job, error)
})

backlinkWorker.on('completed', (job, result) => {
  const log = jobLogger('backlink-sync', job.id)
  log.info({ result }, 'Backlink sync job completed')
})
