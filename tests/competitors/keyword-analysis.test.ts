import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}))

import { analyzeKeywordOverlap } from '@/lib/competitors/keyword-analysis'
import { prisma } from '@/lib/db'

const mockQuery = vi.mocked(prisma.$queryRawUnsafe)

describe('analyzeKeywordOverlap', () => {
  it('correctly partitions shared, source-only, and competitor-only keywords', async () => {
    // Source site keywords
    mockQuery.mockResolvedValueOnce([
      { query: 'seo tips', clicks: 100, impressions: 1000, position: 3.2 },
      { query: 'web design', clicks: 50, impressions: 500, position: 5.0 },
      { query: 'unique source kw', clicks: 20, impressions: 200, position: 8.0 },
    ])

    // Competitor site keywords
    mockQuery.mockResolvedValueOnce([
      { query: 'seo tips', clicks: 80, impressions: 900, position: 6.5 },
      { query: 'web design', clicks: 60, impressions: 600, position: 2.0 },
      { query: 'competitor only kw', clicks: 30, impressions: 300, position: 4.0 },
    ])

    const result = await analyzeKeywordOverlap('site-a', 'site-b', 30)

    expect(result.summary.sharedCount).toBe(2)
    expect(result.summary.onlySourceCount).toBe(1)
    expect(result.summary.onlyCompetitorCount).toBe(1)

    // Shared keywords
    const seoTips = result.shared.find(k => k.query === 'seo tips')!
    expect(seoTips.sourcePosition).toBe(3.2)
    expect(seoTips.competitorPosition).toBe(6.5)
    expect(seoTips.positionGap).toBeCloseTo(3.3) // competitor(6.5) - source(3.2) = positive = you win

    const webDesign = result.shared.find(k => k.query === 'web design')!
    expect(webDesign.positionGap).toBeCloseTo(-3.0) // competitor(2.0) - source(5.0) = negative = you lose

    // Win/lose counts
    expect(result.summary.winCount).toBe(1)
    expect(result.summary.loseCount).toBe(1)

    // Only source
    expect(result.onlySource).toHaveLength(1)
    expect(result.onlySource[0].query).toBe('unique source kw')

    // Only competitor
    expect(result.onlyCompetitor).toHaveLength(1)
    expect(result.onlyCompetitor[0].query).toBe('competitor only kw')
  })

  it('handles empty keyword sets gracefully', async () => {
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([])

    const result = await analyzeKeywordOverlap('site-a', 'site-b', 30)

    expect(result.summary.sharedCount).toBe(0)
    expect(result.summary.onlySourceCount).toBe(0)
    expect(result.summary.onlyCompetitorCount).toBe(0)
    expect(result.summary.avgPositionGap).toBe(0)
    expect(result.summary.winCount).toBe(0)
    expect(result.summary.loseCount).toBe(0)
  })

  it('sorts shared keywords by absolute position gap descending', async () => {
    mockQuery.mockResolvedValueOnce([
      { query: 'kw-small-gap', clicks: 10, impressions: 100, position: 5.0 },
      { query: 'kw-big-gap', clicks: 10, impressions: 100, position: 2.0 },
      { query: 'kw-medium-gap', clicks: 10, impressions: 100, position: 4.0 },
    ])

    mockQuery.mockResolvedValueOnce([
      { query: 'kw-small-gap', clicks: 10, impressions: 100, position: 6.0 },   // gap: 1
      { query: 'kw-big-gap', clicks: 10, impressions: 100, position: 12.0 },    // gap: 10
      { query: 'kw-medium-gap', clicks: 10, impressions: 100, position: 9.0 },  // gap: 5
    ])

    const result = await analyzeKeywordOverlap('site-a', 'site-b', 30)

    expect(result.shared[0].query).toBe('kw-big-gap')
    expect(result.shared[1].query).toBe('kw-medium-gap')
    expect(result.shared[2].query).toBe('kw-small-gap')
  })

  it('sorts unique keywords by clicks descending', async () => {
    mockQuery.mockResolvedValueOnce([
      { query: 'low-clicks', clicks: 5, impressions: 100, position: 10.0 },
      { query: 'high-clicks', clicks: 50, impressions: 100, position: 10.0 },
    ])

    mockQuery.mockResolvedValueOnce([])

    const result = await analyzeKeywordOverlap('site-a', 'site-b', 30)

    expect(result.onlySource[0].query).toBe('high-clicks')
    expect(result.onlySource[1].query).toBe('low-clicks')
  })
})
