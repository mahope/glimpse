import Redis from 'ioredis'
import { logger } from '@/lib/logger'

const log = logger.child({ ctx: 'cache' })

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
    })
    redis.on('error', (err) => {
      log.warn({ err: err.message }, 'Redis cache error (non-fatal)')
    })
  }
  return redis
}

/** Get a cached JSON value. Returns null on miss or Redis error. */
export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null
  try {
    const raw = await client.get(`cache:${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Set a cached JSON value with TTL in seconds. Best-effort, never throws. */
export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    await client.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // best-effort
  }
}

/** Invalidate cache keys by pattern (e.g. "overview:site123:*"). Uses SCAN to avoid blocking Redis. */
export async function invalidateCache(pattern: string): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    const stream = client.scanStream({
      match: `cache:${pattern}`,
      count: 100,
    })
    const pipeline = client.pipeline()
    let count = 0
    for await (const keys of stream) {
      for (const key of keys as string[]) {
        pipeline.del(key)
        count++
      }
    }
    if (count > 0) await pipeline.exec()
  } catch {
    // best-effort
  }
}
