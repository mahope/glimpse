import { describe, it, expect } from 'vitest'
import { parseParams, safePctDelta, ctr, positionImprovementPct } from '@/lib/gsc/params'

describe('parseParams', () => {
  it('defaults and clamps', () => {
    const p = parseParams(new URLSearchParams())
    expect(p.days).toBe(30)
    expect(p.page).toBe(1)
    expect(p.pageSize).toBe(50)
    expect(p.device).toBe('all')
    expect(p.country).toBe('ALL')
    expect(p.sortField).toBe('clicks')
    expect(p.sortDir).toBe('desc')
  })
  it('parses valid inputs', () => {
    const p = parseParams({ days: '7', page: '2', pageSize: '100', device: 'desktop', country: 'dk', sort: 'ctr', dir: 'asc' })
    expect(p.days).toBe(7)
    expect(p.page).toBe(2)
    expect(p.pageSize).toBe(100)
    expect(p.device).toBe('desktop')
    expect(p.country).toBe('DK')
    expect(p.sortField).toBe('ctr')
    expect(p.sortDir).toBe('asc')
  })
  it('guards invalid', () => {
    const p = parseParams({ days: '-10', page: '0', pageSize: '9999', device: 'watch', country: 'xx', sort: 'weird', dir: 'down' })
    expect(p.days).toBe(30)
    expect(p.page).toBe(1)
    expect(p.pageSize).toBe(50)
    expect(p.device).toBe('all')
    expect(p.country).toBe('XX')
    expect(p.sortField).toBe('clicks')
    expect(p.sortDir).toBe('desc')
  })
})

describe('trend helpers', () => {
  it('ctr computes safely', () => {
    expect(ctr(10, 100)).toBe(10)
    expect(ctr(0, 0)).toBe(0)
  })
  it('safePctDelta handles zero prev', () => {
    expect(safePctDelta(10, 0)).toBe(100)
    expect(safePctDelta(0, 0)).toBe(0)
  })
  it('position improvement positive for better rank', () => {
    expect(positionImprovementPct(5, 10)).toBeCloseTo(50)
    expect(positionImprovementPct(10, 5)).toBeCloseTo(-100)
  })
})
