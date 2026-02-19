import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { z } from 'zod'
import { GSCSyncSchema, PsiTestSchema, CrawlSchema, ScoreCalcSchema, UptimeCheckSchema, BacklinkSyncSchema } from './types'

export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
})

export type GSCSyncJobData = z.infer<typeof GSCSyncSchema>
export type PerformanceTestJobData = z.infer<typeof PsiTestSchema>
export type SiteCrawlJobData = z.infer<typeof CrawlSchema>
export type ScoreCalculationJobData = z.infer<typeof ScoreCalcSchema>
export type UptimeCheckJobData = z.infer<typeof UptimeCheckSchema>
export type BacklinkSyncJobData = z.infer<typeof BacklinkSyncSchema>

export const gscSyncQueue = new Queue<GSCSyncJobData>('gsc-sync', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
})

export const performanceQueue = new Queue<PerformanceTestJobData>('performance-test', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  },
})

export const crawlQueue = new Queue<SiteCrawlJobData>('site-crawl', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: 'exponential', delay: 15000 },
  },
})

export const scoreQueue = new Queue<ScoreCalculationJobData>('score-calculation', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
})

export const uptimeCheckQueue = new Queue<UptimeCheckJobData>('uptime-check', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 500,
    removeOnFail: 100,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  },
})

export const backlinkSyncQueue = new Queue<BacklinkSyncJobData>('backlink-sync', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  },
})

export const scheduleJob = {
  gscSync: async (payload: GSCSyncJobData) => gscSyncQueue.add('sync-gsc-data', GSCSyncSchema.parse(payload), { repeat: { cron: '0 2 * * *' }, jobId: `gsc:${payload.siteId}` }),
  performanceTest: async (payload: PerformanceTestJobData) => performanceQueue.add('test-performance', PsiTestSchema.parse(payload), { repeat: { cron: '0 4 * * *' }, jobId: `perf:${payload.siteId}:${payload.device.toLowerCase()}` }),
  siteCrawl: async (payload: SiteCrawlJobData) => crawlQueue.add('crawl-site', CrawlSchema.parse(payload), { repeat: { cron: '0 5 * * 0' }, jobId: `crawl:${payload.siteId}` }),
  scoreCalculation: async (payload: ScoreCalculationJobData) => scoreQueue.add('calculate-scores', ScoreCalcSchema.parse(payload), { repeat: { cron: '0 6 * * *' }, jobId: `score:${payload.siteId}` }),
  uptimeCheck: async (payload: UptimeCheckJobData) => uptimeCheckQueue.add('check-uptime', UptimeCheckSchema.parse(payload), { repeat: { cron: '*/5 * * * *' }, jobId: `uptime:${payload.siteId}` }),
  backlinkSync: async (payload: BacklinkSyncJobData) => backlinkSyncQueue.add('sync-backlinks', BacklinkSyncSchema.parse(payload), { repeat: { cron: '0 3 * * *' }, jobId: `backlink:${payload.siteId}` }),
}

export const triggerJob = {
  gscSync: async (siteId: string, organizationId: string) => gscSyncQueue.add('sync-gsc-data-manual', GSCSyncSchema.parse({ siteId, organizationId }), { jobId: `gsc:${siteId}:${Date.now()}` }),
  performanceTest: async (siteId: string, organizationId: string, url: string, device: 'MOBILE' | 'DESKTOP') => performanceQueue.add('test-performance-manual', PsiTestSchema.parse({ siteId, organizationId, url, device }), { jobId: `perf:${siteId}:${device}:${Date.now()}` }),
  siteCrawl: async (siteId: string, organizationId: string, url: string, maxPages = 50) => crawlQueue.add('crawl-site-manual', CrawlSchema.parse({ siteId, organizationId, url, maxPages }), { jobId: `crawl:${siteId}:${Date.now()}` }),
  scoreCalculation: async (siteId: string, organizationId: string, date?: string) => scoreQueue.add('calculate-scores-manual', ScoreCalcSchema.parse({ siteId, organizationId, date }), { jobId: `score:${siteId}:${Date.now()}` }),
  uptimeCheck: async (siteId: string, organizationId: string, url: string) => uptimeCheckQueue.add('check-uptime-manual', UptimeCheckSchema.parse({ siteId, organizationId, url }), { jobId: `uptime:${siteId}:${Date.now()}` }),
  backlinkSync: async (siteId: string, organizationId: string) => backlinkSyncQueue.add('sync-backlinks-manual', BacklinkSyncSchema.parse({ siteId, organizationId }), { jobId: `backlink:${siteId}:${Date.now()}` }),
}
