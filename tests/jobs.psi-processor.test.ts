import { describe, it, expect, vi } from 'vitest'
import psiProcessor from '@/lib/jobs/processors/psi-test'

vi.mock('@/lib/db', () => ({ prisma: { site: { findFirst: vi.fn().mockResolvedValue({ id: 's1', organizationId: 'o1', isActive: true }) }, performanceTest: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 't1' }), update: vi.fn().mockResolvedValue({}) } } }))
vi.mock('@/lib/performance/pagespeed-client', () => ({ runPageSpeedTest: vi.fn().mockResolvedValue({ score: 88, metrics: { lcp: 2000, inp: 120, cls: 0.05, ttfb: 150, fcp: 1000, speedIndex: 2500 }, lighthouseVersion: '12.0.0', testDuration: 1234 }) }))

function fakeJob(data: any): any { return { data } }

describe('psi processor', () => {
  it('processes and returns score', async () => {
    const res = await psiProcessor(fakeJob({ siteId: 's1', organizationId: 'o1', url: 'https://e.com', device: 'MOBILE' }))
    expect((res as any).ok).toBe(true)
    expect((res as any).score).toBe(88)
  })
})
