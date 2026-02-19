import { z } from 'zod'

export const BaseJobSchema = z.object({
  organizationId: z.string().min(1),
  siteId: z.string().min(1),
})

export const GSCSyncSchema = BaseJobSchema
export type GSCSyncJob = z.infer<typeof GSCSyncSchema>

export const PsiTestSchema = BaseJobSchema.extend({
  url: z.string().url(),
  device: z.enum(['MOBILE', 'DESKTOP']),
})
export type PsiTestJob = z.infer<typeof PsiTestSchema>

export const CrawlSchema = BaseJobSchema.extend({
  url: z.string().url(),
  maxPages: z.number().int().positive().max(500).optional(),
})
export type CrawlJob = z.infer<typeof CrawlSchema>

export const ScoreCalcSchema = BaseJobSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
export type ScoreCalcJob = z.infer<typeof ScoreCalcSchema>

export const UptimeCheckSchema = BaseJobSchema.extend({
  url: z.string().url(),
})
export type UptimeCheckJob = z.infer<typeof UptimeCheckSchema>

export const BacklinkSyncSchema = BaseJobSchema
export type BacklinkSyncJob = z.infer<typeof BacklinkSyncSchema>

export type JobKind = 'gsc-sync' | 'performance-test' | 'site-crawl' | 'score-calculation' | 'uptime-check' | 'backlink-sync'

export const EnqueueJobBodySchema = z.object({
  kind: z.enum(['gsc-sync', 'performance-test', 'site-crawl', 'score-calculation', 'uptime-check', 'backlink-sync']),
  params: z.record(z.any()).optional(),
})
export type EnqueueJobBody = z.infer<typeof EnqueueJobBodySchema>
