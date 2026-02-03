import { describe, it, expect, vi } from 'vitest'

// Minimal shape test for aggregated metrics from GSCService
import { GSCService } from '@/lib/gsc/gsc-service'

// Mock prisma
vi.mock('@/lib/db', () => ({ prisma: {
  searchConsoleData: {
    findMany: vi.fn().mockResolvedValue([
      { date: new Date('2026-01-01'), clicks: 10, impressions: 100, ctr: 0.1, position: 10 },
      { date: new Date('2026-01-02'), clicks: 5, impressions: 50, ctr: 0.1, position: 12 },
    ])
  }
}}))

describe('GSCService.getAggregatedMetrics', () => {
  it('returns normalized array with date, clicks, impressions, ctr, position', async () => {
    const rows = await GSCService.getAggregatedMetrics('site-1', new Date('2026-01-01'), new Date('2026-01-31'))
    expect(rows[0]).toHaveProperty('date')
    expect(rows[0]).toHaveProperty('clicks')
    expect(rows[0]).toHaveProperty('impressions')
    expect(rows[0]).toHaveProperty('ctr')
    expect(rows[0]).toHaveProperty('position')
  })
})
