import { describe, it, expect } from 'vitest'
import { performanceQueue } from '@/lib/jobs/queue'

describe('backoff config', () => {
  it('has exponential backoff configured', () => {
    const opts = (performanceQueue as any).opts?.defaultJobOptions
    expect(opts?.backoff?.type).toBe('exponential')
    expect(opts?.attempts).toBeGreaterThan(0)
  })
})
