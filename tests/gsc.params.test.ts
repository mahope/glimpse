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
    expect(p.search).toBe('')
    expect(p.positionFilter).toBe('')
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
  it('parses search and positionFilter', () => {
    const p = parseParams({ search: '  hello world  ', positionFilter: 'top10' })
    expect(p.search).toBe('hello world')
    expect(p.positionFilter).toBe('top10')
  })
  it('truncates search at 200 chars', () => {
    const p = parseParams({ search: 'a'.repeat(250) })
    expect(p.search.length).toBe(200)
  })
  it('rejects invalid positionFilter', () => {
    const p = parseParams({ positionFilter: 'top99' })
    expect(p.positionFilter).toBe('')
  })
  it('accepts positionDelta as sort field', () => {
    const p = parseParams({ sort: 'positionDelta' })
    expect(p.sortField).toBe('positionDelta')
  })

  it('parses valid from/to custom range', () => {
    const p = parseParams(new URLSearchParams('from=2026-01-01&to=2026-01-31'))
    expect(p.from).toBe('2026-01-01')
    expect(p.to).toBe('2026-01-31')
    expect(p.days).toBe(30)
  })

  it('swaps inverted from/to range', () => {
    const p = parseParams(new URLSearchParams('from=2026-12-31&to=2026-01-01'))
    expect(p.from).toBe('2026-01-01')
    expect(p.to).toBe('2026-12-31')
    expect(p.days).toBeGreaterThan(0)
  })

  it('falls back to days when from format is invalid', () => {
    const p = parseParams(new URLSearchParams('from=bad&to=2026-01-31&days=7'))
    expect(p.from).toBeUndefined()
    expect(p.to).toBeUndefined()
    expect(p.days).toBe(7)
  })

  it('falls back to days when only from is set', () => {
    const p = parseParams(new URLSearchParams('from=2026-01-01&days=14'))
    expect(p.from).toBeUndefined()
    expect(p.days).toBe(14)
  })

  it('clamps custom range days to 365 max', () => {
    const p = parseParams(new URLSearchParams('from=2024-01-01&to=2026-01-01'))
    expect(p.days).toBe(365)
    expect(p.from).toBe('2024-01-01')
    expect(p.to).toBe('2026-01-01')
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
