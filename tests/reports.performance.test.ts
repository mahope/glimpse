import { describe, it, expect } from 'vitest'
import { mapPsiToReport } from '@/lib/reports/sections/performance'

describe('reports/performance mapper', () => {
  it('maps PSI normalized to report CoreWebVitals', () => {
    const psi = {
      timestamp: '2026-02-03T00:00:00.000Z',
      url: 'https://x',
      strategy: 'mobile',
      lab: { score: 88, lcp: 2300, inp: 180, cls: 0.08, fcp: 1200 },
      field: { lcp: 2400, inp: 170, cls: 0.07, fcp: 1300 },
      diagnostics: {},
    } as any
    const s = mapPsiToReport(psi)
    expect(s?.score).toBe(88)
    expect(s?.lcp).toBeCloseTo(2.3)
    expect(s?.fcp).toBeCloseTo(1.2)
  })

  it('returns null on empty input', () => {
    expect(mapPsiToReport(null as any)).toBeNull()
  })
})
