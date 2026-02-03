import { AlertMetric, PerfDevice } from '@prisma/client'
import { SeriesPoint, EvalResult } from './types'

export function pickLatest(series: SeriesPoint[], device: PerfDevice): { latest?: SeriesPoint; prev?: SeriesPoint } {
  const filtered = series.filter(s => s.device === device)
  const byDate = filtered.sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const latest = byDate[0]
  const prev = byDate[1]
  return { latest, prev }
}

export function evaluateRule(metric: AlertMetric, threshold: number, device: PerfDevice, series: SeriesPoint[]): EvalResult {
  const { latest, prev } = pickLatest(series, device)
  if (!latest) return { violated: false, reason: 'no-latest' }

  switch (metric) {
    case 'LCP': {
      const v = latest.lcpPctl ?? undefined
      if (v == null) return { violated: false, reason: 'no-lcp' }
      return { violated: v > threshold, value: v }
    }
    case 'INP': {
      const v = latest.inpPctl ?? undefined
      if (v == null) return { violated: false, reason: 'no-inp' }
      return { violated: v > threshold, value: v }
    }
    case 'CLS': {
      const v = latest.clsPctl ?? undefined
      if (v == null) return { violated: false, reason: 'no-cls' }
      return { violated: v > threshold, value: v }
    }
    case 'SCORE_DROP': {
      if (!prev) return { violated: false, reason: 'no-prev' }
      const a = latest.perfScoreAvg ?? undefined
      const b = prev.perfScoreAvg ?? undefined
      if (a == null || b == null) return { violated: false, reason: 'no-score' }
      const drop = b - a
      return { violated: drop > threshold, value: drop }
    }
  }
}
