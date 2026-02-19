import { gscSyncWorker } from './gsc-sync-worker'
import { scoreWorker } from './score-worker'
import { crawlWorker } from './crawl-worker'
import { perfWorker } from './perf-worker'
import { uptimeWorker } from './uptime-worker'
import { logger } from '@/lib/logger'

const log = logger.child({ ctx: 'workers' })

// Export all workers
export const workers = {
  gscSyncWorker,
  perfWorker,
  scoreWorker,
  crawlWorker,
  uptimeWorker,
}

// Graceful shutdown handler
const gracefulShutdown = async () => {
  log.info('Shutting down workers...')

  await Promise.all([
    gscSyncWorker.close(),
    perfWorker.close(),
    scoreWorker.close(),
    crawlWorker.close(),
    uptimeWorker.close(),
  ])

  log.info('All workers shut down successfully')
  process.exit(0)
}

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)

// Log worker startup
log.info('Starting background job workers...')
log.info({ queues: Object.keys(workers) }, 'Workers started')

export default workers
