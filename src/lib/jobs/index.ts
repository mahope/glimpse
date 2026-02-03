import { startGSCWorker, getGSCQueue } from './gscQueue'

// Import worker files to initialize their Workers
// Each worker file exports a Worker that starts on import
import './workers/gsc-sync-worker'
import './workers/performance-worker'
import './workers/score-worker'
import './workers/crawl-worker'

// Safe startup: only attempt if REDIS_URL present
export function startAllWorkers() {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL not set; skipping worker startup')
    return
  }
  // Explicitly start GSC legacy worker (queue wrapper API)
  startGSCWorker()
  console.log('Workers initialized: gsc-sync, performance-test, score-calc, crawl-site')
}

export function queues() {
  return { gsc: getGSCQueue() }
}
