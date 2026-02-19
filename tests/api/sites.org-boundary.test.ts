import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()
const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: any[]) => mockGetSession(...args) } } }))
vi.mock('@/lib/db', () => ({ prisma: {
  site: {
    findMany: (...args: any[]) => mockFindMany(...args),
    findFirst: (...args: any[]) => mockFindFirst(...args),
    create: (...args: any[]) => mockCreate(...args),
  }
} }))

import * as sites from '@/app/api/sites/route'

function fakeReq(method: string, body?: Record<string, unknown>) {
  const headers = new Headers({ 'content-type': 'application/json' })
  return {
    method,
    headers,
    json: async () => body,
  } as any
}

describe('GET /api/sites — org boundary', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockFindMany.mockReset()
  })

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await sites.GET(fakeReq('GET'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no active organization', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: null } })
    const res = await sites.GET(fakeReq('GET'))
    expect(res.status).toBe(400)
  })

  it('passes organizationId and isActive to findMany', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'org1' } })
    mockFindMany.mockResolvedValue([])
    const res = await sites.GET(fakeReq('GET'))
    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org1', isActive: true },
    }))
  })
})

describe('POST /api/sites — org boundary', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockFindFirst.mockReset()
    mockCreate.mockReset()
  })

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await sites.POST(fakeReq('POST', { name: 'Test', domain: 'test.com', url: 'https://test.com' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no active organization', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: null } })
    const res = await sites.POST(fakeReq('POST', { name: 'Test', domain: 'test.com', url: 'https://test.com' }))
    expect(res.status).toBe(400)
  })

  it('scopes duplicate check to organization', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'org1' } })
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 's1', name: 'Test', domain: 'test.com', url: 'https://test.com', gscConnectedAt: null, createdAt: new Date(), updatedAt: new Date() })

    const res = await sites.POST(fakeReq('POST', { name: 'Test', domain: 'test.com', url: 'https://test.com' }))
    expect(res.status).toBe(201)
    expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { domain: 'test.com', organizationId: 'org1' },
    }))
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org1' }),
    }))
  })

  it('returns 409 when site already exists in same org', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'org1' } })
    mockFindFirst.mockResolvedValue({ id: 's1' })

    const res = await sites.POST(fakeReq('POST', { name: 'Test', domain: 'test.com', url: 'https://test.com' }))
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid input', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'org1' } })
    const res = await sites.POST(fakeReq('POST', { name: '', domain: '', url: 'not-a-url' }))
    expect(res.status).toBe(400)
  })
})
