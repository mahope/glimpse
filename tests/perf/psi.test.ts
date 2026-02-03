import { describe, it, expect } from 'vitest'
import { buildPsiParams, extractLab, extractField, normalizePsi } from '@/lib/perf/psi'

describe('psi param builder', () => {
  it('adds key when present', () => {
    const orig = process.env.PAGESPEED_API_KEY
    process.env.PAGESPEED_API_KEY = 'abc'
    const p = buildPsiParams('https://example.com', 'mobile')
    expect(p.get('strategy')).toBe('mobile')
    expect(p.get('key')).toBe('abc')
    process.env.PAGESPEED_API_KEY = orig
  })

  it('omits key when missing', () => {
    const orig = process.env.PAGESPEED_API_KEY
    delete process.env.PAGESPEED_API_KEY
    const p = buildPsiParams('https://example.com', 'desktop')
    expect(p.get('strategy')).toBe('desktop')
    expect(p.get('key')).toBeNull()
    process.env.PAGESPEED_API_KEY = orig
  })
})

describe('psi extraction', () => {
  const mock = {
    lighthouseResult: {
      categories: { performance: { score: 0.91 } },
      audits: {
        'largest-contentful-paint': { numericValue: 2100 },
        'interaction-to-next-paint': { numericValue: 120 },
        'cumulative-layout-shift': { numericValue: 0.07 },
        'first-contentful-paint': { numericValue: 1000 },
        'total-blocking-time': { numericValue: 80 },
      },
    },
    loadingExperience: {
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2200 },
        INTERACTION_TO_NEXT_PAINT: { percentile: 130 },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 110 },
        FIRST_CONTENTFUL_PAINT_MS: { percentile: 900 },
      },
    },
  }

  it('extracts lab and field safely', () => {
    const lab = extractLab(mock)
    const field = extractField(mock)
    expect(lab.score).toBe(91)
    expect(lab.lcp).toBe(2100)
    expect(field.lcp).toBe(2200)
    expect(field.cls).toBeCloseTo(0.11)
  })

  it('normalizes without throwing when props missing', () => {
    const n = normalizePsi({}, 'https://x', 'mobile')
    expect(n.url).toBe('https://x')
    expect(n.lab.score).toBeUndefined()
  })
})
