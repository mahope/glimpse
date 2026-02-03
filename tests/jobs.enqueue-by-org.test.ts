import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as enqueue } from '@/app/api/sites/[siteId]/jobs/route'

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue({ user: { id: 'u1' }, session: { activeOrganizationId: 'org1' } }) } } }))
vi.mock('@/lib/db', () => ({ prisma: { site: { findFirst: vi.fn().mockResolvedValue({ id: 's1', url: 'https://e.com' }) } } }))
vi.mock('@/lib/jobs/queue', () => ({ triggerJob: { gscSync: vi.fn().mockResolvedValue({ id: 'j1' }), performanceTest: vi.fn().mockResolvedValue({ id: 'j2' }), siteCrawl: vi.fn().mockResolvedValue({ id: 'j3' }), scoreCalculation: vi.fn().mockResolvedValue({ id: 'j4' }) } }))

function mockReq(body: any) {
  return { json: async () => body, headers: new Map(), method: 'POST' } as any
}

describe('enqueue-by-org', () => {
  it('enqueues PSI test', async () => {
    const res: any = await enqueue(mockReq({ kind: 'performance-test', params: { device: 'MOBILE' } }), { params: { siteId: 's1' } } as any)
    const json = await res.json()
    expect(json.jobId).toBe('j2')
  })
})
