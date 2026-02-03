import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as perfDailyGET } from '@/app/api/sites/[siteId]/perf/daily/route'

// Mock auth session
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'u1', role: 'CUSTOMER' } })) } },
}))

// Mock prisma
const site = { id: 's1', organizationId: 'o1', isActive: true, organization: { members: [{ userId: 'u1' }] } }
vi.mock('@/lib/db', () => ({
  prisma: {
    site: { findUnique: vi.fn(async () => site) },
    sitePerfDaily: { findMany: vi.fn(async ({ where }: any) => {
      // Return 2 per date when device filter ALL not applied, else 1
      const base = [
        { date: new Date('2026-02-01'), device: 'MOBILE', lcpPctl: 2000, inpPctl: 100, clsPctl: 0.05, perfScoreAvg: 90, pagesMeasured: 2 },
        { date: new Date('2026-02-01'), device: 'DESKTOP', lcpPctl: 1800, inpPctl: 80, clsPctl: 0.03, perfScoreAvg: 95, pagesMeasured: 2 },
      ]
      if (where.device) return base.filter(r => r.device === where.device)
      return base
    }) },
  }
}))

function makeRequest(url: string) {
  return new NextRequest(url) as any
}

describe('perf daily endpoint device filter', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('returns mobile-only when device=MOBILE', async () => {
    const res = await perfDailyGET(makeRequest('http://localhost/api/sites/s1/perf/daily?device=MOBILE&days=2'), { params: { siteId: 's1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toHaveLength(1)
    expect(json.items[0].scoreAvg).toBe(90)
  })
  it('returns desktop-only when device=DESKTOP', async () => {
    const res = await perfDailyGET(makeRequest('http://localhost/api/sites/s1/perf/daily?device=DESKTOP&days=2'), { params: { siteId: 's1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toHaveLength(1)
    expect(json.items[0].scoreAvg).toBe(95)
  })
  it('returns all rows when device=ALL', async () => {
    const res = await perfDailyGET(makeRequest('http://localhost/api/sites/s1/perf/daily?device=ALL&days=2'), { params: { siteId: 's1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toHaveLength(2)
  })
})
