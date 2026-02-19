import { prisma } from '@/lib/db'
import Redis from 'ioredis'
import { logger } from '@/lib/logger'
import { incrementCounter } from '@/lib/metrics/collector'

const log = logger.child({ module: 'psi-service' })

export type Strategy = 'MOBILE' | 'DESKTOP'

export type PsiMetrics = {
  url: string
  strategy: Strategy
  date: Date
  // Lab (Lighthouse)
  perfScore?: number
  lcpMs?: number
  inpMs?: number
  cls?: number
  ttfbMs?: number
  // Field (CrUX percentiles)
  field?: {
    lcpPctl?: number // ms
    inpPctl?: number // ms
    clsPctl?: number // score * 1000? (CLS is unitless percentile value)
  }
  raw?: any
}

export type CwvStatus = 'pass' | 'needs-improvement' | 'fail'

export type CwvSummary = {
  lcp: CwvStatus
  inp: CwvStatus
  cls: CwvStatus
}

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const KEY = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY || ''
const PSI_DAILY_CAP = parseInt(process.env.PSI_DAILY_CAP || '200', 10)

let psiRedis: Redis | null = null

function getPsiRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!psiRedis) {
    psiRedis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    psiRedis.on('error', () => {})
  }
  return psiRedis
}

// In-process fallback when Redis is unavailable
let fallbackCount = 0
let fallbackDay = new Date().toDateString()

async function checkDailyLimit() {
  const today = new Date().toISOString().split('T')[0]
  const redis = getPsiRedis()

  if (redis) {
    try {
      const key = `psi:daily:${today}`
      const count = await redis.get(key)
      const current = count ? parseInt(count, 10) : 0
      if (current >= PSI_DAILY_CAP) {
        throw new Error(`PSI daily cap reached (${PSI_DAILY_CAP})`)
      }
      if (current >= PSI_DAILY_CAP * 0.8) {
        log.warn({ current, cap: PSI_DAILY_CAP }, 'Approaching PSI daily cap')
      }
      return
    } catch (e) {
      if (e instanceof Error && e.message.includes('daily cap')) throw e
      // Redis error — fall through to in-process
    }
  }

  // Fallback: in-process counter
  const nowDay = new Date().toDateString()
  if (nowDay !== fallbackDay) { fallbackDay = nowDay; fallbackCount = 0 }
  if (fallbackCount >= PSI_DAILY_CAP) throw new Error(`PSI daily cap reached (${PSI_DAILY_CAP})`)
}

async function incrementDailyCount() {
  const today = new Date().toISOString().split('T')[0]
  const redis = getPsiRedis()
  if (redis) {
    try {
      const key = `psi:daily:${today}`
      await redis.incr(key)
      await redis.expire(key, 90000) // 25 hours TTL
      return
    } catch {
      // Redis error — fall through
    }
  }
  fallbackCount++
}

async function fetchWithBackoff(url: string, init?: RequestInit, attempt = 0): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status === 429 || res.status === 503) {
    if (attempt >= 4) return res
    const wait = Math.min(60000, 1000 * Math.pow(2, attempt))
    await new Promise(r => setTimeout(r, wait))
    return fetchWithBackoff(url, init, attempt + 1)
  }
  return res
}

export function summarizeCWV(metrics: { lcpMs?: number; inpMs?: number; cls?: number }): CwvSummary {
  const lcp = metrics.lcpMs ?? Infinity
  const inp = metrics.inpMs ?? Infinity
  const cls = metrics.cls ?? Infinity
  const status = (value: number, good: number, meh: number): CwvStatus => {
    if (value <= good) return 'pass'
    if (value <= meh) return 'needs-improvement'
    return 'fail'
  }
  return {
    lcp: status(lcp, 2500, 4000),
    inp: status(inp, 200, 500),
    cls: status(cls, 0.1, 0.25),
  }
}

/**
 * Strip PSI response to ~5-10KB instead of 200-500KB.
 * Keeps: scores, metrics, CrUX field data, and audit summaries.
 * Drops: full DOM snapshots, screenshot data, network requests, etc.
 */
function stripPsiResponse(data: any): any {
  if (!data) return null
  const lh = data.lighthouseResult
  const audits = lh?.audits || {}
  const keepAuditKeys = [
    'largest-contentful-paint', 'interaction-to-next-paint',
    'cumulative-layout-shift', 'server-response-time',
    'first-contentful-paint', 'speed-index', 'total-blocking-time',
  ]
  const slimAudits: Record<string, any> = {}
  for (const key of keepAuditKeys) {
    if (audits[key]) {
      slimAudits[key] = {
        id: audits[key].id,
        title: audits[key].title,
        score: audits[key].score,
        numericValue: audits[key].numericValue,
        displayValue: audits[key].displayValue,
      }
    }
  }
  return {
    id: data.id,
    analysisUTCTimestamp: data.analysisUTCTimestamp,
    lighthouseResult: {
      lighthouseVersion: lh?.lighthouseVersion,
      fetchTime: lh?.fetchTime,
      requestedUrl: lh?.requestedUrl,
      finalUrl: lh?.finalUrl,
      categories: lh?.categories ? {
        performance: {
          score: lh.categories.performance?.score,
          title: lh.categories.performance?.title,
        },
      } : undefined,
      audits: slimAudits,
    },
    loadingExperience: data.loadingExperience ? {
      metrics: data.loadingExperience.metrics,
      overall_category: data.loadingExperience.overall_category,
    } : undefined,
  }
}

export async function runPsi(url: string, strategy: Strategy): Promise<PsiMetrics> {
  await checkDailyLimit()
  const params = new URLSearchParams({
    url,
    strategy: strategy.toLowerCase(),
    category: 'performance',
  })
  if (KEY) params.set('key', KEY)

  const res = await fetchWithBackoff(`${API}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    incrementCounter('psi:errors').catch(() => {})
    throw new Error(`PSI error ${res.status}: ${txt}`)
  }
  incrementCounter('psi:calls').catch(() => {})
  await incrementDailyCount()
  const data = await res.json()

  const lh = data?.lighthouseResult
  const audits = lh?.audits || {}
  const categories = lh?.categories || {}
  const loading = data?.loadingExperience?.metrics || {}

  const perfScore = categories?.performance?.score != null ? Math.round(categories.performance.score * 100) : undefined
  const lcpMs = audits['largest-contentful-paint']?.numericValue
  const inpMs = audits['interaction-to-next-paint']?.numericValue
  const cls = audits['cumulative-layout-shift']?.numericValue
  const ttfbMs = audits['server-response-time']?.numericValue

  const field = {
    lcpPctl: loading?.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
    inpPctl: loading?.INTERACTION_TO_NEXT_PAINT?.percentile,
    clsPctl: loading?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile,
  }

  return {
    url,
    strategy,
    date: new Date(),
    perfScore,
    lcpMs,
    inpMs,
    cls,
    ttfbMs,
    field,
    raw: stripPsiResponse(data),
  }
}

export async function saveSnapshot(siteId: string, m: PsiMetrics) {
  await prisma.perfSnapshot.create({
    data: {
      siteId,
      url: m.url,
      strategy: m.strategy,
      date: m.date,
      lcpMs: m.lcpMs != null ? Math.round(m.lcpMs) : null,
      inpMs: m.inpMs != null ? Math.round(m.inpMs) : null,
      cls: m.cls ?? null,
      ttfbMs: m.ttfbMs != null ? Math.round(m.ttfbMs) : null,
      perfScore: m.perfScore ?? null,
      isField: m.field ? true : null,
      isLab: true,
      raw: m.raw ?? null,
    },
  })
}

export async function upsertDaily(siteId: string, date: Date, device: 'ALL' | 'MOBILE' | 'DESKTOP' = 'ALL') {
  // Compute latest daily aggregates from snapshots of that date (optionally per device)
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  const where: any = { siteId, date: { gte: start, lt: end } }
  if (device !== 'ALL') where.strategy = device

  const snaps = await prisma.perfSnapshot.findMany({ where })

  const perfScores = snaps.map(s => s.perfScore).filter((n): n is number => n != null)
  const avg = perfScores.length ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length) : null

  // Use field percentiles preferentially (first available)
  const lcpPctl = snaps.map(s => s.raw?.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile).find((v): v is number => !!v) || null
  const inpPctl = snaps.map(s => s.raw?.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile).find((v): v is number => !!v) || null
  const clsPctl = snaps.map(s => s.raw?.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile).find((v): v is number => !!v) || null

  await prisma.sitePerfDaily.upsert({
    where: { siteId_date_device: { siteId, date: start, device } as any },
    update: {
      device,
      perfScoreAvg: avg,
      lcpPctl: lcpPctl ? Math.round(lcpPctl) : null,
      inpPctl: inpPctl ? Math.round(inpPctl) : null,
      clsPctl: clsPctl ? Math.round(clsPctl) : null,
      pagesMeasured: snaps.length,
    },
    create: {
      siteId,
      date: start,
      device,
      perfScoreAvg: avg,
      lcpPctl: lcpPctl ? Math.round(lcpPctl) : null,
      inpPctl: inpPctl ? Math.round(inpPctl) : null,
      clsPctl: clsPctl ? Math.round(clsPctl) : null,
      pagesMeasured: snaps.length,
    },
  })
}
