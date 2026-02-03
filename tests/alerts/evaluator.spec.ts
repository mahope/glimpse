import { describe, it, expect } from 'vitest'
import { evaluateRule } from '@/lib/alerts/evaluator'
import { AlertMetric, PerfDevice } from '@prisma/client'
import type { SeriesPoint } from '@/lib/alerts/types'

const mkPoint = (d: string, dev: PerfDevice, vals: Partial<SeriesPoint> = {}): SeriesPoint => ({
  date: new Date(d),
  device: dev,
  lcpPctl: null,
  inpPctl: null,
  clsPctl: null,
  perfScoreAvg: null,
  ...vals,
})

describe('alerts evaluator', () => {
  it('LCP violation when over threshold per device', () => {
    const series: SeriesPoint[] = [
      mkPoint('2026-02-01', 'MOBILE', { lcpPctl: 2600 }),
      mkPoint('2026-02-01', 'DESKTOP', { lcpPctl: 1800 }),
      mkPoint('2026-02-02', 'MOBILE', { lcpPctl: 2700 }),
      mkPoint('2026-02-02', 'DESKTOP', { lcpPctl: 2100 }),
    ]
    expect(evaluateRule('LCP', 2500, 'MOBILE', series).violated).toBe(true)
    expect(evaluateRule('LCP', 2000, 'DESKTOP', series).violated).toBe(true)
    expect(evaluateRule('LCP', 2800, 'MOBILE', series).violated).toBe(false)
  })

  it('INP and CLS violations', () => {
    const series: SeriesPoint[] = [
      mkPoint('2026-02-02', 'ALL', { inpPctl: 250, clsPctl: 0.12 }),
    ]
    expect(evaluateRule('INP', 200, 'ALL', series).violated).toBe(true)
    expect(evaluateRule('CLS', 0.1, 'ALL', series).violated).toBe(true)
  })

  it('SCORE_DROP compares latest vs previous day', () => {
    const series: SeriesPoint[] = [
      mkPoint('2026-02-01', 'ALL', { perfScoreAvg: 85 }),
      mkPoint('2026-02-02', 'ALL', { perfScoreAvg: 70 }),
    ]
    const res = evaluateRule('SCORE_DROP', 10, 'ALL', series)
    expect(res.violated).toBe(true)
    expect(res.value).toBe(15)
  })

  it('device scoping ensures correct series used', () => {
    const series: SeriesPoint[] = [
      mkPoint('2026-02-01', 'MOBILE', { lcpPctl: 3000 }),
      mkPoint('2026-02-02', 'DESKTOP', { lcpPctl: 1000 }),
    ]
    expect(evaluateRule('LCP', 2500, 'DESKTOP', series).violated).toBe(false)
    expect(evaluateRule('LCP', 2500, 'MOBILE', series).violated).toBe(true)
  })
})
