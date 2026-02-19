import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()
const mockSiteFindFirst = vi.fn()
const mockRuleFindMany = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: (...args: any[]) => mockGetSession(...args) } },
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    site: { findFirst: (...args: any[]) => mockSiteFindFirst(...args) },
    alertRule: { findMany: (...args: any[]) => mockRuleFindMany(...args) },
  },
}))

import { GET } from '@/app/api/sites/[siteId]/alerts/rules/route'

function fakeReq(method: string) {
  return {
    method,
    headers: new Headers({ 'content-type': 'application/json' }),
    url: 'http://localhost:3000/api/sites/site1/alerts/rules',
  } as any
}

describe('GET /api/sites/[siteId]/alerts/rules — org boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 without session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET(fakeReq('GET'), { params: { siteId: 'site1' } })
    expect(res.status).toBe(401)
  })

  it('returns 403 when no active organization', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1' },
      session: { activeOrganizationId: null },
    })
    const res = await GET(fakeReq('GET'), { params: { siteId: 'site1' } })
    expect(res.status).toBe(403)
  })

  it('returns 404 when site not found or not in organization', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u-attacker' },
      session: { activeOrganizationId: 'org-attacker' },
    })
    // findFirst returns null because site doesn't belong to org-attacker
    mockSiteFindFirst.mockResolvedValue(null)
    const res = await GET(fakeReq('GET'), { params: { siteId: 'site1' } })
    expect(res.status).toBe(404)
  })

  it('scopes site lookup to organizationId', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1' },
      session: { activeOrganizationId: 'org1' },
    })
    mockSiteFindFirst.mockResolvedValue({ id: 'site1' })
    mockRuleFindMany.mockResolvedValue([])
    await GET(fakeReq('GET'), { params: { siteId: 'site1' } })

    expect(mockSiteFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'site1', organizationId: 'org1', isActive: true },
    }))
  })

  it('returns 200 with rules when user has access', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1' },
      session: { activeOrganizationId: 'org1' },
    })
    mockSiteFindFirst.mockResolvedValue({ id: 'site1' })
    mockRuleFindMany.mockResolvedValue([{ id: 'r1', metric: 'LCP' }])
    const res = await GET(fakeReq('GET'), { params: { siteId: 'site1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
  })
})
