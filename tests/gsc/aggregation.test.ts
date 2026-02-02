import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/db'

const siteId = 'agg_site'

describe('Aggregation routes', () => {
  beforeAll(async () => {
    await prisma.site.upsert({ where: { id: siteId }, update: {}, create: { id: siteId, name: 'Agg', domain: 'agg.dev', url: 'https://agg.dev', organizationId: 'org1' } })
    const day = new Date('2026-01-05')
    // Seed some rows
    await prisma.searchStatDaily.createMany({ data: [
      { siteId, date: day, pageUrl: 'https://agg.dev/a', query: 'alpha', device: 'desktop', country: 'DK', clicks: 10, impressions: 100, ctr: 10, position: 5 },
      { siteId, date: day, pageUrl: 'https://agg.dev/b', query: 'beta', device: 'desktop', country: 'DK', clicks: 5, impressions: 50, ctr: 10, position: 7 },
      { siteId, date: day, pageUrl: 'https://agg.dev/a', query: 'alpha', device: 'mobile', country: 'DK', clicks: 3, impressions: 30, ctr: 10, position: 6 },
    ] })
  })

  it('groups by query', async () => {
    const end = new Date('2026-01-06'); const start = new Date('2025-12-01')
    const rows = await prisma.searchStatDaily.groupBy({
      by: ['query'], where: { siteId, date: { gte: start, lte: end } }, _sum: { clicks: true, impressions: true }, _avg: { position: true }
    })
    const alpha = rows.find(r => r.query === 'alpha')!
    expect(alpha._sum.clicks).toBe(13)
    expect(alpha._sum.impressions).toBe(130)
  })

  it('groups by pageUrl', async () => {
    const end = new Date('2026-01-06'); const start = new Date('2025-12-01')
    const rows = await prisma.searchStatDaily.groupBy({ by: ['pageUrl'], where: { siteId, date: { gte: start, lte: end } }, _sum: { clicks: true, impressions: true }, _avg: { position: true } })
    const a = rows.find(r => r.pageUrl === 'https://agg.dev/a')!
    expect(a._sum.clicks).toBe(13)
  })
})
