import { describe, it, expect, vi } from 'vitest'
import psiProcessor from '@/lib/jobs/processors/psi-test'

vi.mock('@/lib/db', () => ({ prisma: {
  site: { findFirst: vi.fn().mockResolvedValue({ id: 's1', organizationId: 'o1', isActive: true }) },
  perfSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
} }))

vi.mock('@/lib/perf/psi-service', () => ({
  runPsi: vi.fn().mockResolvedValue({ perfScore: 90, url: 'https://e.com', date: new Date(), lcpMs: 2000, inpMs: 120, cls: 0.05, ttfbMs: 150, raw: {} }),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  upsertDaily: vi.fn().mockResolvedValue(undefined),
}))

function fakeJob(data: any): any { return { data } }

describe('psi processor', () => {
  it('processes and returns score', async () => {
    const res = await psiProcessor(fakeJob({ siteId: 's1', organizationId: 'o1', url: 'https://e.com', device: 'MOBILE' }))
    expect((res as any).ok).toBe(true)
    expect((res as any).score).toBe(90)
  })
})
