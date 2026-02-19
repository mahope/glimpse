// Import worker files to initialize their Workers
// Each worker file exports a Worker that starts on import
import './workers/gsc-sync-worker'
import './workers/perf-worker'
import './workers/score-worker'
import './workers/crawl-worker'
import { logger } from '@/lib/logger'

const log = logger.child({ ctx: 'workers' })

// Safe startup: only attempt if REDIS_URL present
export function startAllWorkers() {
  if (!process.env.REDIS_URL) {
    log.warn('REDIS_URL not set; skipping worker startup')
    return
  }
  log.info({ queues: ['gsc-sync', 'performance-test', 'score-calc', 'crawl-site'] }, 'Workers initialized')
}
