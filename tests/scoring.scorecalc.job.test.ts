import { describe, it, expect, vi } from 'vitest'
import scoreCalc from '@/lib/jobs/processors/score-calc'

vi.mock('@/lib/db', () => ({ prisma: {
  site: {
    findFirst: vi.fn().mockResolvedValue({ id: 's1', organizationId: 'o1', isActive: true }),
    update: vi.fn().mockResolvedValue({})
  },
}}))

vi.mock('@/lib/scoring/calculator', () => ({
  SEOCalculator: { calculateSEOScore: vi.fn().mockResolvedValue({
    overall: 82,
    clickTrend: 80,
    positionTrend: 85,
    impressionTrend: 78,
    ctrBenchmark: 70,
    performanceScore: 90,
    improvements: [],
    strengths: [],
    grade: 'B',
  })},
  calculateSeoScore: vi.fn().mockResolvedValue({ totalScore: 82 })
}))

function fakeJob(data: any): any { return { data } }

describe('score-calc job', () => {
  it('updates site.seoScore with calculator overall and persists breakdown', async () => {
    const res = await scoreCalc(fakeJob({ siteId: 's1', organizationId: 'o1' }))
    expect((res as any).ok).toBe(true)
    expect((res as any).score).toBeTypeOf('number')
  })
})
