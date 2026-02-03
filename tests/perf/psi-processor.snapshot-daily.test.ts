import { describe, it, expect, vi, beforeEach } from 'vitest'
import psiProcessor from '@/lib/jobs/processors/psi-test'

// Mock DB and PSI service
vi.mock('@/lib/db', () => ({ prisma: {
  site: { findFirst: vi.fn().mockResolvedValue({ id: 's1', organizationId: 'o1', isActive: true }) },
  performanceTest: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 't1' }),
    update: vi.fn().mockResolvedValue({})
  },
  perfSnapshot: { create: vi.fn().mockResolvedValue({ id: 'ps1' }) },
  sitePerfDaily: { upsert: vi.fn().mockResolvedValue({ id: 'd1' }) },
}}))

vi.mock('@/lib/perf/psi-service', () => ({
  runPsi: vi.fn().mockResolvedValue({
    url: 'https://e.com',
    strategy: 'MOBILE',
    date: new Date('2026-02-03T00:00:00.000Z'),
    perfScore: 91,
    lcpMs: 2100,
    inpMs: 120,
    cls: 0.08,
    ttfbMs: 180,
    raw: { lighthouseResult: { lighthouseVersion: '12.0.0' }, loadingExperience: { metrics: {} }},
  }),
  saveSnapshot: vi.fn(async (_siteId: string, _m: any) => {
    const { prisma } = await import('@/lib/db') as any
    await prisma.perfSnapshot.create({ data: {} as any })
  }),
  upsertDaily: vi.fn(async (_siteId: string, _date: Date) => {
    const { prisma } = await import('@/lib/db') as any
    await prisma.sitePerfDaily.upsert({ where: { siteId_date: { siteId: 's1', date: new Date('2026-02-03') } } } as any)
  }),
}))

function fakeJob(data: any): any { return { data } }

describe('psi processor post-job hooks', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('writes snapshot and daily aggregate after completion', async () => {
    const res = await psiProcessor(fakeJob({ siteId: 's1', organizationId: 'o1', url: 'https://e.com', device: 'MOBILE' }))
    expect((res as any).ok).toBe(true)

    const { prisma } = await import('@/lib/db') as any
    expect(prisma.perfSnapshot.create).toHaveBeenCalled()
    expect(prisma.sitePerfDaily.upsert).toHaveBeenCalled()
  })
})
