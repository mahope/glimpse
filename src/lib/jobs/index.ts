import { startGSCWorker, getGSCQueue } from './gscQueue'

// Safe startup: only attempt if REDIS_URL present
export function startAllWorkers() {
  startGSCWorker()
}

export function queues() {
  return { gsc: getGSCQueue() }
}
