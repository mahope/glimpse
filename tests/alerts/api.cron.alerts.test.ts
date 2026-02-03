import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const sites = [
    { id: 's1', name: 'Site One', isActive: true },
  ]
  const rules = [
    { id: 'r1', siteId: 's1', metric: 'LCP', device: 'MOBILE', threshold: 2500, windowDays: 1, enabled: true, recipients: ['a@example.com'] },
    { id: 'r2', siteId: 's1', metric: 'SCORE_DROP', device: 'ALL', threshold: 10, windowDays: 1, enabled: true, recipients: ['a@example.com'] },
  ] as any
  const perf = [
    { siteId: 's1', date: new Date('2026-02-02'), device: 'MOBILE', lcpPctl: 2600, inpPctl: 180, clsPctl: 0.05, perfScoreAvg: 70 },
    { siteId: 's1', date: new Date('2026-02-01'), device: 'MOBILE', lcpPctl: 2400, inpPctl: 180, clsPctl: 0.05, perfScoreAvg: 85 },
    { siteId: 's1', date: new Date('2026-02-02'), device: 'DESKTOP', lcpPctl: 2100, inpPctl: 180, clsPctl: 0.05, perfScoreAvg: 70 },
    { siteId: 's1', date: new Date('2026-02-01'), device: 'DESKTOP', lcpPctl: 1800, inpPctl: 180, clsPctl: 0.05, perfScoreAvg: 85 },
  ]

  const events: any[] = []

  return {
    prisma: {
      site: { findMany: vi.fn().mockResolvedValue(sites) },
      alertRule: { findMany: vi.fn().mockResolvedValue(rules) },
      sitePerfDaily: { findMany: vi.fn().mockResolvedValue(perf) },
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

describe('cron alerts', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test'
  })

  it('creates events for violations and sends email', async () => {
    const res = await POST(req() as any)
    const json = await (res as any).json()
    expect(json.ok).toBe(true)
    // should create 2 events (LCP mobile and score drop)
    const created = json.results.filter((r: any) => r.created)
    expect(created.length).toBe(2)
  })

  it('debounces when open event exists in last 24h', async () => {
    // First run creates
    await POST(req() as any)
    // Second run should skip
    const res = await POST(req() as any)
    const json = await (res as any).json()
    const skipped = json.results.filter((r: any) => r.skipped)
    expect(skipped.length).toBeGreaterThan(0)
  })

  it('resolves next day when condition clears', async () => {
    // trigger create first
    await POST(req() as any)
    // Now mock clear next day
    const mod = (await import('@/lib/db')).prisma.sitePerfDaily.findMany as any
    mod.mockResolvedValueOnce([
      { siteId: 's1', date: new Date('2026-02-03'), device: 'MOBILE', lcpPctl: 2000, perfScoreAvg: 70 },
      { siteId: 's1', date: new Date('2026-02-02'), device: 'MOBILE', lcpPctl: 2600, perfScoreAvg: 85 },
    ])
    const res = await POST(req() as any)
    const json = await (res as any).json()
    const resolved = json.results.filter((r: any) => r.resolved)
    expect(resolved.length).toBeGreaterThan(0)
  })
})
