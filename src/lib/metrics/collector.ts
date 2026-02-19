import Redis from 'ioredis'

const PREFIX = 'metrics:'
const ROUTES_SET = `${PREFIX}api:routes`
const RETENTION_HOURS = 24 * 7 // 7 days
const VALID_KEY_PATTERN = /^[a-zA-Z0-9:/_-]{1,100}$/

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 })
  }
  return redis
}

function sanitizeKey(key: string): string | null {
  return VALID_KEY_PATTERN.test(key) ? key : null
}

/** Record an API response time sample */
export async function recordApiLatency(route: string, durationMs: number) {
  const conn = getRedis()
  if (!conn) return
  const safeRoute = sanitizeKey(route)
  if (!safeRoute) return

  try {
    const key = `${PREFIX}api:${safeRoute}`
    const now = Date.now()
    await conn.zadd(key, now, `${durationMs}|${now}`)
    await conn.sadd(ROUTES_SET, safeRoute)
    const cutoff = now - RETENTION_HOURS * 60 * 60 * 1000
    await conn.zremrangebyscore(key, 0, cutoff)
  } catch {
    // Redis unavailable — silently skip
  }
}

/** Increment a counter (e.g. PSI calls, errors) */
export async function incrementCounter(name: string, amount = 1) {
  const conn = getRedis()
  if (!conn) return
  const safeName = sanitizeKey(name)
  if (!safeName) return

  try {
    const hourKey = `${PREFIX}counter:${safeName}:${getHourBucket()}`
    await conn.incrby(hourKey, amount)
    await conn.expire(hourKey, RETENTION_HOURS * 60 * 60)
  } catch {
    // Redis unavailable
  }
}

/** Get counter sum for last N hours */
export async function getCounterSum(name: string, hours = 24): Promise<number> {
  const conn = getRedis()
  if (!conn) return 0

  try {
    const now = new Date()
    let total = 0
    for (let i = 0; i < hours; i++) {
      const date = new Date(now.getTime() - i * 60 * 60 * 1000)
      const key = `${PREFIX}counter:${name}:${formatHour(date)}`
      const val = await conn.get(key)
      if (val) total += parseInt(val, 10)
    }
    return total
  } catch {
    return 0
  }
}

/** Get counter values per hour for last N hours (for charts) */
export async function getCounterTimeSeries(name: string, hours = 24): Promise<{ hour: string; value: number }[]> {
  const conn = getRedis()
  if (!conn) return []

  try {
    const now = new Date()
    const series: { hour: string; value: number }[] = []
    for (let i = hours - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 60 * 60 * 1000)
      const bucket = formatHour(date)
      const key = `${PREFIX}counter:${name}:${bucket}`
      const val = await conn.get(key)
      series.push({
        hour: bucket.slice(5), // MM-DD:HH
        value: val ? parseInt(val, 10) : 0,
      })
    }
    return series
  } catch {
    return []
  }
}

/** Calculate latency percentiles for an API route */
export async function getApiLatencyStats(route: string, windowMinutes = 60): Promise<{
  p50: number
  p95: number
  p99: number
  count: number
  avg: number
}> {
  const conn = getRedis()
  if (!conn) return { p50: 0, p95: 0, p99: 0, count: 0, avg: 0 }

  try {
    const key = `${PREFIX}api:${route}`
    const cutoff = Date.now() - windowMinutes * 60 * 1000
    const entries = await conn.zrangebyscore(key, cutoff, '+inf')
    if (entries.length === 0) return { p50: 0, p95: 0, p99: 0, count: 0, avg: 0 }

    const values = entries
      .map(e => parseFloat(e.split('|')[0]))
      .filter(v => !Number.isNaN(v))
      .sort((a, b) => a - b)
    const count = values.length
    if (count === 0) return { p50: 0, p95: 0, p99: 0, count: 0, avg: 0 }

    const avg = Math.round(values.reduce((s, v) => s + v, 0) / count)

    return {
      p50: values[Math.floor(count * 0.5)] || 0,
      p95: values[Math.floor(count * 0.95)] || 0,
      p99: values[Math.floor(count * 0.99)] || 0,
      count,
      avg,
    }
  } catch {
    return { p50: 0, p95: 0, p99: 0, count: 0, avg: 0 }
  }
}

/** Get all tracked API route names */
export async function getTrackedRoutes(): Promise<string[]> {
  const conn = getRedis()
  if (!conn) return []

  try {
    return await conn.smembers(ROUTES_SET)
  } catch {
    return []
  }
}

function getHourBucket(): string {
  return formatHour(new Date())
}

function formatHour(date: Date): string {
  return date.toISOString().slice(0, 13).replace('T', ':')
}
