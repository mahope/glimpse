import { describe, it, expect } from 'vitest'
import { renderReportPDF } from '@/lib/reports/pdf-generator'

describe('Report PDF generator', () => {
  it('renders to a buffer (smoke test)', async () => {
    const buf = await renderReportPDF({
      site: { id: 's1', name: 'Example', domain: 'example.com', url: 'https://example.com', organization: { name: 'Org', logo: null } },
      period: { from: new Date().toISOString(), to: new Date().toISOString(), label: 'Test' },
      generatedAt: new Date().toISOString(),
      seoScore: 75,
      kpis: [
        { label: 'Clicks', value: 100 },
        { label: 'Impressions', value: 1000 },
        { label: 'Avg. Position', value: '12.3' },
        { label: 'CTR', value: '10.0%' }
      ],
      performance: { lcp: 2.5, inp: 200, cls: 0.05, ttfb: 150, fcp: 1.2, speedIndex: 3.1 },
      topKeywords: [ { keyword: 'test', clicks: 10, impressions: 100, ctr: 0.1, position: 5 } ],
      issues: [ { id: 'i1', title: 'Missing meta description', severity: 'medium' } ],
      trends: [ { date: '2026-01-01', clicks: 1, impressions: 10, position: 10, ctr: 0.1 } ]
    } as any)
    // In some environments, @react-pdf returns a Uint8Array. Accept that too.
    const isBuf = Buffer.isBuffer(buf) || buf instanceof Uint8Array
    expect(isBuf).toBe(true)
    const len = (buf as any).byteLength ?? (buf as any).length ?? 0
    expect(len).toBeGreaterThan(0)
  })
})
