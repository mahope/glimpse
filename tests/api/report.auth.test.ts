import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: any[]) => mockGetSession(...args) } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/reports/pdf-generator', () => ({ renderReportPDF: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')) }))

vi.mock('@/lib/db', () => ({ prisma: {
  site: {
    findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id === 'site1' && where?.organizationId === 'org1') {
        return {
          id: 'site1', name: 'Test Site', domain: 'test.com', url: 'https://test.com',
          organization: { name: 'Test Org', logo: null },
          seoScores: [], perfSnapshots: [], searchStatsDaily: [], crawlResults: [],
        }
      }
      return null
    })
  }
} }))

import * as report from '@/app/api/sites/[siteId]/report/route'

class FakeReq {
  url: string
  constructor(url: string) { this.url = url }
}

describe('GET /api/sites/:id/report — auth', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
  })

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await report.GET(new FakeReq('http://x/api/sites/site1/report') as any, { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no active organization', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: null } })
    const res = await report.GET(new FakeReq('http://x/api/sites/site1/report') as any, { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(400)
  })

  it('returns 404 when site belongs to different org', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'other-org' } })
    const res = await report.GET(new FakeReq('http://x/api/sites/site1/report') as any, { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(404)
  })

  it('returns PDF when authenticated with correct org', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'org1' } })
    const res = await report.GET(new FakeReq('http://x/api/sites/site1/report') as any, { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('test.com-latest.pdf')
  })
})
