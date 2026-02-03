import { describe, it, expect } from 'vitest'
import { GSCSyncSchema, PsiTestSchema, CrawlSchema, ScoreCalcSchema } from '@/lib/jobs/types'

describe('zod payloads', () => {
  it('validates PSI payload', () => {
    const parsed = PsiTestSchema.parse({ organizationId: 'org', siteId: 'site', url: 'https://example.com', device: 'MOBILE' })
    expect(parsed.device).toBe('MOBILE')
  })
  it('rejects invalid URL', () => {
    expect(() => PsiTestSchema.parse({ organizationId: 'o', siteId: 's', url: 'bad', device: 'DESKTOP' })).toThrow()
  })
  it('allows optional maxPages', () => {
    const p = CrawlSchema.parse({ organizationId: 'o', siteId: 's', url: 'https://e.com' })
    expect(p.maxPages).toBeUndefined()
  })
  it('accepts optional date', () => {
    const p = ScoreCalcSchema.parse({ organizationId: 'o', siteId: 's', date: '2026-02-03' })
    expect(p.date).toBe('2026-02-03')
  })
})
