import { describe, it, expect, beforeEach, vi } from 'vitest'
import { summarizeCWV, runPsi } from '@/lib/perf/psi-service'

describe('psi-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('summarizeCWV maps thresholds correctly', () => {
    expect(summarizeCWV({ lcpMs: 2400, inpMs: 180, cls: 0.08 })).toEqual({ lcp: 'pass', inp: 'pass', cls: 'pass' })
    expect(summarizeCWV({ lcpMs: 3000, inpMs: 300, cls: 0.15 })).toEqual({ lcp: 'needs-improvement', inp: 'needs-improvement', cls: 'needs-improvement' })
    expect(summarizeCWV({ lcpMs: 4200, inpMs: 700, cls: 0.3 })).toEqual({ lcp: 'fail', inp: 'fail', cls: 'fail' })
  })

  it('parses PSI response into metrics', async () => {
    const mockJson = {
      lighthouseResult: {
        categories: { performance: { score: 0.91 } },
        audits: {
          'largest-contentful-paint': { numericValue: 2100 },
          'interaction-to-next-paint': { numericValue: 120 },
          'cumulative-layout-shift': { numericValue: 0.07 },
          'server-response-time': { numericValue: 180 },
        },
      },
      loadingExperience: {
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2200 },
          INTERACTION_TO_NEXT_PAINT: { percentile: 130 },
          CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 10 },
        },
      },
    }

    vi.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => mockJson })

    const m = await runPsi('https://example.com', 'MOBILE')
    expect(m.perfScore).toBe(91)
    expect(m.lcpMs).toBe(2100)
    expect(m.inpMs).toBe(120)
    expect(m.cls).toBe(0.07)
    expect(m.ttfbMs).toBe(180)
    expect(m.field?.lcpPctl).toBe(2200)
  })
})
