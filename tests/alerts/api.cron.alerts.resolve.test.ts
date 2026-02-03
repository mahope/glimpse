import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const sites = [ { id: 's1', name: 'Site One', isActive: true } ]
  const rules = [ { id: 'r1', siteId: 's1', metric: 'LCP', device: 'MOBILE', threshold: 2500, windowDays: 1, enabled: true, recipients: ['a@example.com'] } ] as any
  const perfA = [
    { siteId: 's1', date: new Date('2026-02-01'), device: 'MOBILE', lcpPctl: 2600, perfScoreAvg: 80 },
  ]
  const perfB = [
    { siteId: 's1', date: new Date('2026-02-02'), device: 'MOBILE', lcpPctl: 2000, perfScoreAvg: 82 },
    { siteId: 's1', date: new Date('2026-02-01'), device: 'MOBILE', lcpPctl: 2600, perfScoreAvg: 80 },
  ]

  const events: any[] = []

  return {
    prisma: {
      site: { findMany: vi.fn().mockResolvedValue(sites) },
      alertRule: { findMany: vi.fn().mockResolvedValue(rules) },
      sitePerfDaily: { findMany: vi.fn().mockResolvedValue(perfA) },
      alertEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(events.filter(e => e.siteId === where.siteId && e.metric === where.metric && e.device === where.device && e.status === where.status))),
        create: vi.fn().mockImplementation(({ data }: any) => { const ev = { id: `e${events.length+1}`, ...data }; events.push(ev); return Promise.resolve(ev) }),
        update: vi.fn().mockImplementation(({ where, data }: any) => { const i = events.findIndex(e => e.id === where.id); events[i] = { ...events[i], ...data }; return Promise.resolve(events[i]); }),
      },
    }
  }
})

vi.mock('@/lib/email/alerts', () => ({ sendAlertEmail: vi.fn().mockResolvedValue(undefined) }))

import { POST } from '@/app/api/cron/alerts/route'

function req() {
  return new Request('http://localhost/api/cron/alerts', { method: 'POST', headers: { authorization: 'Bearer test' } })
}

describe('cron alerts resolves', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test'
  })

  it('resolves open events when next day is under threshold', async () => {
    // First run with perfA creates open event
    let res = await POST(req() as any)
    let json = await (res as any).json()
    expect(json.results.some((r: any) => r.created)).toBe(true)

    // Swap mock to perfB (under threshold)
    const mod = (await import('@/lib/db')).prisma.sitePerfDaily.findMany as any
    mod.mockResolvedValueOnce([
      { siteId: 's1', date: new Date('2026-02-02'), device: 'MOBILE', lcpPctl: 2000, perfScoreAvg: 82 },
      { siteId: 's1', date: new Date('2026-02-01'), device: 'MOBILE', lcpPctl: 2600, perfScoreAvg: 80 },
    ])

    res = await POST(req() as any)
    json = await (res as any).json()
    expect(json.results.some((r: any) => r.resolved)).toBe(true)
  })
})
