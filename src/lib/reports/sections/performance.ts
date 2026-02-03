import type { ReportData, CoreWebVitals } from '../types'
import type { PsiNormalized } from '@/lib/perf/psi'

export type PerformanceSection = CoreWebVitals & {
  source: 'psi'
  strategy: 'mobile' | 'desktop' | 'combined'
  score?: number
  fetchedAt?: string
}

export function mapPsiToReport(psi: PsiNormalized | null | undefined): PerformanceSection | null {
  if (!psi) return null
  const lcpMs = psi.lab.lcp ?? psi.field.lcp
  const inpMs = psi.lab.inp ?? psi.field.inp
  const cls = psi.lab.cls ?? psi.field.cls
  const fcpMs = psi.lab.fcp ?? psi.field.fcp
  return {
    source: 'psi',
    strategy: psi.strategy,
    score: psi.lab.score,
    lcp: typeof lcpMs === 'number' ? Math.round(lcpMs) / 1000 : undefined, // seconds in report
    inp: typeof inpMs === 'number' ? Math.round(inpMs) : undefined, // ms
    cls: typeof cls === 'number' ? cls : undefined,
    fcp: typeof fcpMs === 'number' ? Math.round(fcpMs) / 1000 : undefined, // seconds
    ttfb: typeof psi.lab.tbt === 'number' ? undefined : undefined, // keep ttfb out (not reliable in LH)
    speedIndex: undefined,
    fetchedAt: psi.timestamp,
  }
}
