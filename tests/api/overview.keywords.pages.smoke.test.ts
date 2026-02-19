import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'org1' } }) } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))

// Minimal prisma mocks used by the route handlers
vi.mock('@/lib/db', () => ({ prisma: {
  site: { findFirst: vi.fn().mockImplementation(async ({ where }: any) => where?.id === 'site1' && where?.organizationId === 'org1' ? ({ id: 'site1' }) : null) },
  $queryRawUnsafe: vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('COUNT(DISTINCT') || sql.includes('COUNT(*)')) return [{ count: BigInt(2) }]
    if (sql.includes('"query"')) return [{ query: 'alpha', clicks: BigInt(8), impressions: BigInt(80), position: 4.0 }]
    if (sql.includes('"page_url"')) return [{ page_url: 'https://ex.com/', clicks: BigInt(5), impressions: BigInt(50), position: 6.0 }]
    return []
  }),
  keywordTagAssignment: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  searchStatDaily: {
    aggregate: vi.fn().mockResolvedValue({ _sum: { clicks: 10, impressions: 100 }, _avg: { position: 5 } }),
    groupBy: vi.fn().mockImplementation(async ({ by, where, _sum, _avg, _count, orderBy, take }: any) => {
      if (_count) return [{ query: 'a', _count: { query: 1 } }, { query: 'b', _count: { query: 1 } }]
      if (by.includes('date')) {
        return [
          { date: new Date('2026-02-01'), _sum: { clicks: 3, impressions: 30 }, _avg: { position: 6 } },
          { date: new Date('2026-02-02'), _sum: { clicks: 7, impressions: 70 }, _avg: { position: 4 } },
        ]
      }
      if (by.includes('query')) {
        return [ { query: 'alpha', _sum: { clicks: 8, impressions: 80 }, _avg: { position: 4 } } ]
      }
      if (by.includes('pageUrl')) {
        return [ { pageUrl: 'https://ex.com/', _sum: { clicks: 5, impressions: 50 }, _avg: { position: 6 } } ]
      }
      return []
    })
  }
} }))

// Import after mocks so the route modules use them
import * as overview from '@/app/api/sites/[siteId]/overview/route'
import * as keywords from '@/app/api/sites/[siteId]/gsc/keywords/route'
import * as pages from '@/app/api/sites/[siteId]/gsc/pages/route'

class FakeReq {
  url: string
  constructor(url: string) { this.url = url }
}

describe('API smoke: overview, keywords, pages', () => {
  beforeEach(() => {
    // reset timers if any
  })

  it('GET /api/sites/:id/overview returns basic shape', async () => {
    const res = await overview.GET(new FakeReq('http://x/api/sites/site1/overview?days=30') as any, { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.kpis).toBeTruthy()
    expect(json.timeline?.length).toBeGreaterThan(0)
  })

  it('GET /api/sites/:id/gsc/keywords returns items and pagination', async () => {
    const res = await keywords.GET(new FakeReq('http://x/api/sites/site1/gsc/keywords?page=1&pageSize=10') as any, { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.items)).toBe(true)
    expect(json.page).toBeDefined()
    expect(json.totalItems).toBeGreaterThanOrEqual(0)
  })

  it('GET /api/sites/:id/gsc/pages returns items and pagination', async () => {
    const res = await pages.GET(new FakeReq('http://x/api/sites/site1/gsc/pages?page=1&pageSize=10') as any, { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.items)).toBe(true)
    expect(json.page).toBeDefined()
    expect(json.totalItems).toBeGreaterThanOrEqual(0)
  })
})
