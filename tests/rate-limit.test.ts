import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

// Mock ioredis — the rate limiter falls back to allowing all if Redis is unavailable
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      pipeline: vi.fn().mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],  // zremrangebyscore
          [null, 1],  // zadd
          [null, 1],  // zcard — first request, count = 1
          [null, 1],  // expire
        ]),
      }),
      zrange: vi.fn().mockResolvedValue([]),
    })),
  }
})

describe('rate-limit', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('allows requests when Redis is not configured', async () => {
    delete process.env.REDIS_URL
    // Re-import to get fresh module state
    const { checkRateLimit: freshCheck } = await import('@/lib/rate-limit')
    const result = await freshCheck('test-key', { limit: 5, windowSeconds: 60 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })

  it('allows requests within limit when Redis is available', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    const { checkRateLimit: freshCheck } = await import('@/lib/rate-limit')
    const result = await freshCheck('test-key', { limit: 5, windowSeconds: 60 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4) // limit(5) - count(1) = 4
  })
})
