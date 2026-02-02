// Core Web Vitals thresholds based on Google's official guidelines

export interface PerformanceThreshold {
  good: number
  needsImprovement: number
  // Values above needsImprovement are considered "poor"
}

export const CORE_WEB_VITALS_THRESHOLDS = {
  // Largest Contentful Paint (seconds)
  LCP: {
    good: 2.5,
    needsImprovement: 4.0,
  },
  // Interaction to Next Paint (milliseconds)
  INP: {
    good: 200,
    needsImprovement: 500,
  },
  // Cumulative Layout Shift (unitless)
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  // Time to First Byte (milliseconds)
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
  // First Contentful Paint (seconds)
  FCP: {
    good: 1.8,
    needsImprovement: 3.0,
  },
} as const

export type PerformanceStatus = 'good' | 'needs-improvement' | 'poor'

export function getPerformanceStatus(
  metric: keyof typeof CORE_WEB_VITALS_THRESHOLDS,
  value: number
): PerformanceStatus {
  const threshold = CORE_WEB_VITALS_THRESHOLDS[metric]
  
  if (value <= threshold.good) {
    return 'good'
  }
  
  if (value <= threshold.needsImprovement) {
    return 'needs-improvement'
  }
  
  return 'poor'
}

export function getPerformanceColor(status: PerformanceStatus): string {
  switch (status) {
    case 'good':
      return '#0cce6b' // Green
    case 'needs-improvement':
      return '#ffa400' // Orange
    case 'poor':
      return '#ff4e42' // Red
    default:
      return '#6b7280' // Gray
  }
}

export function getOverallPerformanceScore(metrics: {
  lcp?: number
  inp?: number
  cls?: number
  ttfb?: number
  fcp?: number
}): number {
  const scores: number[] = []
  
  // Convert each metric to a 0-100 score
  if (metrics.lcp !== undefined) {
    const lcpScore = getMetricScore('LCP', metrics.lcp)
    scores.push(lcpScore)
  }
  
  if (metrics.inp !== undefined) {
    const inpScore = getMetricScore('INP', metrics.inp)
    scores.push(inpScore)
  }
  
  if (metrics.cls !== undefined) {
    const clsScore = getMetricScore('CLS', metrics.cls)
    scores.push(clsScore)
  }
  
  if (metrics.ttfb !== undefined) {
    const ttfbScore = getMetricScore('TTFB', metrics.ttfb)
    scores.push(ttfbScore * 0.5) // TTFB has lower weight
  }
  
  if (metrics.fcp !== undefined) {
    const fcpScore = getMetricScore('FCP', metrics.fcp)
    scores.push(fcpScore * 0.7) // FCP has moderate weight
  }
  
  if (scores.length === 0) {
    return 0
  }
  
  // Calculate weighted average
  const totalScore = scores.reduce((sum, score) => sum + score, 0)
  return Math.round(totalScore / scores.length)
}

function getMetricScore(
  metric: keyof typeof CORE_WEB_VITALS_THRESHOLDS,
  value: number
): number {
  const threshold = CORE_WEB_VITALS_THRESHOLDS[metric]
  
  if (value <= threshold.good) {
    // Score between 90-100 for good values
    return 90 + (10 * (1 - value / threshold.good))
  }
  
  if (value <= threshold.needsImprovement) {
    // Score between 50-89 for needs improvement
    const ratio = (value - threshold.good) / (threshold.needsImprovement - threshold.good)
    return 90 - (40 * ratio)
  }
  
  // Score between 0-49 for poor values
  const poorRatio = Math.min(
    (value - threshold.needsImprovement) / threshold.needsImprovement,
    1
  )
  return 50 - (50 * poorRatio)
}