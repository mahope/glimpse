import { NextResponse } from 'next/server'
import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
    redis.on('error', () => {}) // suppress connection errors — rate limiting is best-effort
  }
  return redis
}

interface RateLimitConfig {
  /** Max number of requests in the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Sliding-window rate limiter backed by Redis.
 * Falls back to allowing all requests if Redis is unavailable.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const client = getRedis()
  if (!client) {
    return { allowed: true, remaining: config.limit, retryAfterSeconds: 0 }
  }

  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const windowStart = now - windowMs
  const redisKey = `rl:${key}`

  try {
    // Use a sorted set: score = timestamp, member = unique request id
    const pipeline = client.pipeline()
    pipeline.zremrangebyscore(redisKey, 0, windowStart) // remove expired entries
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`) // add current request
    pipeline.zcard(redisKey) // count entries in window
    pipeline.expire(redisKey, config.windowSeconds + 1) // TTL for cleanup
    const results = await pipeline.exec()

    const count = (results?.[2]?.[1] as number) ?? 0
    const allowed = count <= config.limit
    const remaining = Math.max(0, config.limit - count)

    if (!allowed) {
      // Find oldest entry to calculate retry-after
      const oldest = await client.zrange(redisKey, 0, 0, 'WITHSCORES')
      const oldestTs = oldest.length >= 2 ? parseInt(oldest[1], 10) : now
      const retryAfterSeconds = Math.ceil((oldestTs + windowMs - now) / 1000)
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) }
    }

    return { allowed: true, remaining, retryAfterSeconds: 0 }
  } catch {
    // Redis error — fail open
    return { allowed: true, remaining: config.limit, retryAfterSeconds: 0 }
  }
}

/**
 * Returns a 429 response if rate limit exceeded, or null if allowed.
 */
export async function rateLimitOrNull(
  key: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const result = await checkRateLimit(key, config)
  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }
  return null
}
