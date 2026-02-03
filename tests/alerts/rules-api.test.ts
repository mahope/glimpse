import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => {
  const rules: any[] = []
  const site = { id: 'site1', organizationId: 'org1', organization: { members: [{ userId: 'user1' }] } }
  return {
    prisma: {
      site: { findUnique: vi.fn(async ({ where }: any) => where.id === 'site1' ? site : null) },
      alertRule: {
        findMany: vi.fn(async ({ where }: any) => rules.filter(r => r.siteId === where.siteId)),
        create: vi.fn(async ({ data }: any) => { const r = { id: 'r'+(rules.length+1), createdAt: new Date(), updatedAt: new Date(), ...data }; rules.unshift(r); return r }),
        findFirst: vi.fn(async ({ where }: any) => rules.find(r => r.id === where.id && r.siteId === where.siteId) || null),
        update: vi.fn(async ({ where, data }: any) => { const i = rules.findIndex(r => r.id === where.id); if (i===-1) throw new Error('nf'); rules[i] = { ...rules[i], ...data, id: rules[i].id }; return rules[i] }),
        delete: vi.fn(async ({ where }: any) => { const i = rules.findIndex(r => r.id === where.id); if (i===-1) throw new Error('nf'); const [r] = rules.splice(i,1); return r }),
      }
    }
  }
})

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'user1', role: 'ADMIN' }, session: { activeOrganizationId: 'org1' } })) } }
}))

import * as route from '@/app/api/sites/[siteId]/alerts/rules/route'

function makeReq(method: string, body?: any) {
  const url = 'http://localhost/api/sites/site1/alerts/rules'
  return new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined } as any)
}

describe('Alert Rules API', () => {
  beforeEach(() => {
    // reset mocks state if needed
  })

  it('creates and lists rules', async () => {
    const res1 = await route.POST(makeReq('POST'), { params: { siteId: 'site1' } } as any)
    expect(res1.status).toBe(201)
    const created = await res1.json()
    expect(created.item).toBeTruthy()

    const res2 = await route.GET(makeReq('GET'), { params: { siteId: 'site1' } } as any)
    expect(res2.status).toBe(200)
    const list = await res2.json()
    expect(Array.isArray(list.items)).toBe(true)
    expect(list.items.length).toBeGreaterThan(0)
  })

  it('updates a rule', async () => {
    const r = await (await route.POST(makeReq('POST', { metric: 'INP', device: 'ALL', threshold: 200, recipients: [] }), { params: { siteId: 'site1' } } as any)).json()
    const res = await route.PATCH(makeReq('PATCH', { id: r.item.id, threshold: 300 }), { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.item.threshold).toBe(300)
  })

  it('deletes a rule', async () => {
    const r = await (await route.POST(makeReq('POST', { metric: 'CLS', device: 'ALL', threshold: 0.1, recipients: [] }), { params: { siteId: 'site1' } } as any)).json()
    const res = await route.DELETE(makeReq('DELETE?'+new URLSearchParams({ id: r.item.id }).toString()), { params: { siteId: 'site1' } } as any)
    expect(res.status).toBe(200)
  })
})
