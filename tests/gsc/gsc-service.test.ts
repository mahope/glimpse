import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { fetchAndStoreGSCDaily } from '@/lib/gsc/fetch-daily'
import { prisma } from '@/lib/db'

// Mock prisma for unit test scope by using a test db url if provided

describe('GSC daily fetcher (mock mode)', () => {
  it('seeds mock rows when MOCK_GSC is true or creds missing', async () => {
    const siteId = 'test_site'
    await prisma.site.upsert({ where: { id: siteId }, update: {}, create: { id: siteId, name: 'Test', domain: 'example.com', url: 'https://example.com', organizationId: 'org1' } })

    const res = await fetchAndStoreGSCDaily({ siteId, propertyUrl: 'sc-domain:example.com', startDate: '2026-01-01', endDate: '2026-01-03', mock: true })
    expect(res.mocked).toBe(true)
    expect(res.records).toBeGreaterThan(0)
  })
})
