import { Queue, Worker, Job } from 'bullmq'
import Redis from 'ioredis'

// Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
})

// Job Types
export type GSCSyncJobData = {
  siteId: string
  organizationId: string
}

export type PerformanceTestJobData = {
  siteId: string
  organizationId: string
  url: string
  device: 'MOBILE' | 'DESKTOP'
}

export type SiteCrawlJobData = {
  siteId: string
  organizationId: string
  url: string
  maxPages?: number
}

export type ScoreCalculationJobData = {
  siteId: string
  organizationId: string
  date?: string
}

// Create queues
export const gscSyncQueue = new Queue<GSCSyncJobData>('gsc-sync', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
})

export const performanceQueue = new Queue<PerformanceTestJobData>('performance-test', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
})

export const crawlQueue = new Queue<SiteCrawlJobData>('site-crawl', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 15000,
    },
  },
})

export const scoreQueue = new Queue<ScoreCalculationJobData>('score-calculation', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
})

// Helper function to add jobs with proper scheduling
export const scheduleJob = {
  gscSync: async (siteId: string, organizationId: string) => {
    return gscSyncQueue.add('sync-gsc-data', { siteId, organizationId }, {
      // Run daily at 2 AM
      repeat: { cron: '0 2 * * *' }
    })
  },

  performanceTest: async (siteId: string, organizationId: string, url: string, device: 'MOBILE' | 'DESKTOP') => {
    return performanceQueue.add('test-performance', { siteId, organizationId, url, device }, {
      // Run daily at 4 AM
      repeat: { cron: '0 4 * * *' }
    })
  },

  siteCrawl: async (siteId: string, organizationId: string, url: string, maxPages = 50) => {
    return crawlQueue.add('crawl-site', { siteId, organizationId, url, maxPages }, {
      // Run weekly on Sunday at 5 AM
      repeat: { cron: '0 5 * * 0' }
    })
  },

  scoreCalculation: async (siteId: string, organizationId: string, date?: string) => {
    return scoreQueue.add('calculate-scores', { siteId, organizationId, date }, {
      // Run daily at 6 AM
      repeat: { cron: '0 6 * * *' }
    })
  },
}

// Manual job triggering (for immediate execution)
export const triggerJob = {
  gscSync: async (siteId: string, organizationId: string) => {
    return gscSyncQueue.add('sync-gsc-data-manual', { siteId, organizationId })
  },

  performanceTest: async (siteId: string, organizationId: string, url: string, device: 'MOBILE' | 'DESKTOP') => {
    return performanceQueue.add('test-performance-manual', { siteId, organizationId, url, device })
  },

  siteCrawl: async (siteId: string, organizationId: string, url: string, maxPages = 50) => {
    return crawlQueue.add('crawl-site-manual', { siteId, organizationId, url, maxPages })
  },

  scoreCalculation: async (siteId: string, organizationId: string, date?: string) => {
    return scoreQueue.add('calculate-scores-manual', { siteId, organizationId, date })
  },
}

export { redisConnection }