import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('REDIS_URL', '')

describe('GSC queue safe init', () => {
  it('does not throw without REDIS_URL', async () => {
    const mod = await import('@/lib/jobs/gscQueue')
    expect(mod.getGSCQueue()).toBeUndefined()
    const worker = mod.startGSCWorker()
    expect(worker).toBeUndefined()
  })
})
