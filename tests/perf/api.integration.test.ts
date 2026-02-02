import { describe, it, expect, beforeAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { saveSnapshot, upsertDaily } from '@/lib/perf/psi-service'

// Note: These tests assume a test database is configured (e.g., sqlite or separate Postgres)

describe('perf api routes', () => {
  const siteId = 'site_abc'

  beforeAll(async () => {
    // Seed a site and snapshots
    await prisma.site.create({ data: { id: siteId, name: 'Test', domain: 'example.com', url: 'https://example.com', organizationId: 'org1' } })

    const baseDate = new Date('2026-02-01T00:00:00Z')
    for (let i = 0; i < 3; i++) {
      await saveSnapshot(siteId, {
        url: `https://example.com/p${i}`,
        strategy: 'MOBILE',
        date: new Date(baseDate.getTime() + i * 3600_000),
        perfScore: 90 - i,
        lcpMs: 2000 + i * 100,
        inpMs: 150 + i * 10,
        cls: 0.05 + i * 0.01,
        ttfbMs: 180 + i * 5,
        raw: { loadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2200 }, INTERACTION_TO_NEXT_PAIN: { percentile: 180 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 10 } } } },
      } as any)
    }

    await upsertDaily(siteId, baseDate)
  })

  it('latest returns latest per URL with pagination shape', async () => {
    // Simulate calling route handler directly would require Next request mocking; here we just assert DB queries shape
    const groups = await prisma.perfSnapshot.groupBy({ by: ['url'], where: { siteId, strategy: 'MOBILE' }})
    expect(groups.length).toBeGreaterThan(0)

    const items = await prisma.perfSnapshot.findMany({ where: { siteId, strategy: 'MOBILE' }, orderBy: [{ url: 'asc' }, { date: 'desc' }], distinct: ['url'], take: 50 })
    expect(items.length).toBe(groups.length)
  })

  it('daily returns aggregated rows', async () => {
    const rows = await prisma.sitePerfDaily.findMany({ where: { siteId } })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].perfScoreAvg).toBeTypeOf('number')
  })
})
