import { describe, it, expect, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as perfDailyGET } from '@/app/api/sites/[siteId]/perf/daily/route'
import { POST as enqueuePOST } from '@/app/api/sites/[siteId]/jobs/route'

// Minimal session mock helper
const makeSession = (userId: string, orgId: string) => ({
  user: { id: userId, role: 'CUSTOMER' },
  session: { activeOrganizationId: orgId },
}) as any

vi.mock('@/lib/auth', () => {
  return {
    auth: {
      api: {
        getSession: vi.fn(async ({ headers }: any) => {
          const authHeader = headers && (headers['x-test-session'] as string)
          if (!authHeader) return null
          const [userId, orgId] = authHeader.split(':')
          return makeSession(userId, orgId)
        }),
      },
    },
  }
})

// Prisma mock: two orgs with different sites
vi.mock('@/lib/db', () => {
  const siteA = { id: 'siteA', organizationId: 'org1', isActive: true, url: 'https://a.test' }
  const siteB = { id: 'siteB', organizationId: 'org2', isActive: true, url: 'https://b.test' }
  return {
    prisma: {
      site: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id === 'siteA') return { ...siteA, organization: { members: [] } }
          if (where.id === 'siteB') return { ...siteB, organization: { members: [] } }
          return null
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.id === 'siteA' && where.organizationId === 'org1') return siteA
          if (where.id === 'siteB' && where.organizationId === 'org2') return siteB
          return null
        }),
      },
      perfSnapshot: {
        groupBy: vi.fn(async ({ by, where }: any) => []),
        findMany: vi.fn(async () => []),
      },
      sitePerfDaily: {
        findMany: vi.fn(async () => []),
      },
    },
  }
})

function makeRequest(url: string, sessionHeader?: string) {
  return new NextRequest(url, { headers: sessionHeader ? { 'x-test-session': sessionHeader } as any : undefined }) as any
}

describe('Org boundary checks', () => {
  it('denies perf daily for site in another org', async () => {
    const req = makeRequest('http://localhost/api/sites/siteB/perf/daily?days=7', 'user1:org1')
    const res = await perfDailyGET(req, { params: { siteId: 'siteB' } })
    // Our mocked prisma.site.findUnique returns no org members for any site
    // and the route allows admin or org members only → expect 403
    expect(res.status).toBe(403)
  })

  it('allows enqueue only within same org (skipped if redis missing)', async () => {
    // Avoid hitting BullMQ/Redis in unit test: just assert org filter rejects other-org site
    const reqBad = new NextRequest('http://localhost/api/sites/siteB/jobs', { method: 'POST', headers: { 'x-test-session': 'user1:org1' } as any, body: JSON.stringify({ kind: 'score-calculation' }) } as any)
    const bad = await enqueuePOST(reqBad as any, { params: { siteId: 'siteB' } })
    expect(bad.status).toBe(404)
  })
})
