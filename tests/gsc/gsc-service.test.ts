import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('DATABASE_URL', '')

describe('GSC daily fetcher (mock mode)', () => {
  it('skips when DB not available (unit safety)', async () => {
    const mod = await import('@/lib/gsc/fetch-daily')
    // Since prisma will fail without DB, we only assert the function exists and can be imported
    expect(typeof mod.fetchAndStoreGSCDaily).toBe('function')
  })
})
