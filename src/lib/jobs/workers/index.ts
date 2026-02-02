import { gscSyncWorker } from './gsc-sync-worker'
import { performanceWorker } from './performance-worker'
import { scoreWorker } from './score-worker'
import { crawlWorker } from './crawl-worker'

// Export all workers
export const workers = {
  gscSyncWorker,
  performanceWorker,
  scoreWorker,
  crawlWorker,
}

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('Shutting down workers...')
  
  await Promise.all([
    gscSyncWorker.close(),
    performanceWorker.close(),
    scoreWorker.close(),
    crawlWorker.close(),
  ])
  
  console.log('All workers shut down successfully')
  process.exit(0)
}

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)

// Log worker startup
console.log('Starting background job workers...')
console.log('Workers started:', Object.keys(workers))

export default workers