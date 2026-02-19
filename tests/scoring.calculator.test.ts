import { describe, it, expect, vi } from 'vitest'
import { SEOCalculator } from '@/lib/scoring/calculator'

// Prisma is used inside calculator; mock its methods to avoid DB
vi.mock('@/lib/db', () => ({ prisma: {
  searchStatDaily: { aggregate: vi.fn().mockResolvedValue({ _sum: { clicks: 0, impressions: 0 }, _avg: { position: 50 } }) },
  perfSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
  seoScore: { create: vi.fn(), upsert: vi.fn() }
}}))

describe('SEOCalculator', () => {
  it('handles zero data gracefully and bounds score 0-100', async () => {
    const res = await SEOCalculator.calculateSEOScore('site-1')
    expect(res.overall).toBeGreaterThanOrEqual(0)
    expect(res.overall).toBeLessThanOrEqual(100)
  })

  it('grade mapping works at edges', () => {
    // Access private via any for test
    const anyCalc: any = SEOCalculator
    expect(anyCalc["getGrade"](100)).toBe('A+')
    expect(anyCalc["getGrade"](95)).toBe('A+')
    expect(anyCalc["getGrade"](90)).toBe('A')
    expect(anyCalc["getGrade"](80)).toBe('B')
    expect(anyCalc["getGrade"](70)).toBe('C')
    expect(anyCalc["getGrade"](60)).toBe('D')
    expect(anyCalc["getGrade"](59)).toBe('F')
  })
})
