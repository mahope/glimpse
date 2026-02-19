import { prisma } from '@/lib/db'
import { safePctDelta } from '@/lib/gsc/params'

export type Severity = 'critical' | 'important' | 'suggestion'

export interface Recommendation {
  id: string
  severity: Severity
  category: 'performance' | 'content' | 'search' | 'technical'
  title: string
  description: string
  metric?: string
  value?: number
}

export async function generateRecommendations(siteId: string): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = []

  const now = new Date()
  const d30Ago = new Date(); d30Ago.setDate(now.getDate() - 30)
  const d60Ago = new Date(); d60Ago.setDate(now.getDate() - 60)

  // Fetch all data in parallel
  const [perfDaily, crawlReport, gscCurr, gscPrev, keywordsCurr, keywordsPrev] = await Promise.all([
    // Latest mobile performance
    prisma.sitePerfDaily.findFirst({
      where: { siteId, device: { in: ['MOBILE', 'ALL'] } },
      orderBy: [{ device: 'asc' }, { date: 'desc' }],
    }),
    // Latest crawl report
    prisma.crawlReport.findFirst({
      where: { siteId },
      orderBy: { startedAt: 'desc' },
    }),
    // Current 30d GSC aggregate
    prisma.searchStatDaily.aggregate({
      where: { siteId, date: { gte: d30Ago, lte: now } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    // Previous 30d GSC aggregate
    prisma.searchStatDaily.aggregate({
      where: { siteId, date: { gte: d60Ago, lt: d30Ago } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    // Top declining keywords (current period)
    prisma.searchStatDaily.groupBy({
      by: ['query'],
      where: { siteId, date: { gte: d30Ago, lte: now } },
      _avg: { position: true },
      _sum: { clicks: true },
      orderBy: { _sum: { clicks: 'desc' } },
      take: 20,
    }),
    // Same keywords (previous period)
    prisma.searchStatDaily.groupBy({
      by: ['query'],
      where: { siteId, date: { gte: d60Ago, lt: d30Ago } },
      _avg: { position: true },
      _sum: { clicks: true },
      orderBy: { _sum: { clicks: 'desc' } },
      take: 50,
    }),
  ])

  // === PERFORMANCE RULES ===

  if (perfDaily) {
    // LCP > 4s = critical, > 2.5s = important
    if (perfDaily.lcpPctl != null) {
      if (perfDaily.lcpPctl > 4000) {
        recommendations.push({
          id: 'perf-lcp-poor',
          severity: 'critical',
          category: 'performance',
          title: 'LCP er kritisk langsom',
          description: `LCP er ${(perfDaily.lcpPctl / 1000).toFixed(1)}s. Optimer billeder, brug lazy loading, og reducer server-responstid. Målet er under 2.5s.`,
          metric: 'LCP', value: perfDaily.lcpPctl,
        })
      } else if (perfDaily.lcpPctl > 2500) {
        recommendations.push({
          id: 'perf-lcp-warn',
          severity: 'important',
          category: 'performance',
          title: 'LCP kan forbedres',
          description: `LCP er ${(perfDaily.lcpPctl / 1000).toFixed(1)}s. Overvej at optimere billeder og reducere server-tid for at komme under 2.5s.`,
          metric: 'LCP', value: perfDaily.lcpPctl,
        })
      }
    }

    // CLS > 0.25 = critical, > 0.1 = important
    if (perfDaily.clsPctl != null) {
      const cls = perfDaily.clsPctl / 1000 // stored as integer * 1000
      if (cls > 0.25) {
        recommendations.push({
          id: 'perf-cls-poor',
          severity: 'critical',
          category: 'performance',
          title: 'CLS er for høj',
          description: `CLS er ${cls.toFixed(3)}. Tilføj width/height attributter til billeder og undgå dynamisk indhold der skubber layout. Målet er under 0.1.`,
          metric: 'CLS', value: cls,
        })
      } else if (cls > 0.1) {
        recommendations.push({
          id: 'perf-cls-warn',
          severity: 'important',
          category: 'performance',
          title: 'CLS kan forbedres',
          description: `CLS er ${cls.toFixed(3)}. Sørg for at alle billeder har dimensions og undgå sent-loadede elementer.`,
          metric: 'CLS', value: cls,
        })
      }
    }

    // INP > 500ms = critical, > 200ms = important
    if (perfDaily.inpPctl != null) {
      if (perfDaily.inpPctl > 500) {
        recommendations.push({
          id: 'perf-inp-poor',
          severity: 'critical',
          category: 'performance',
          title: 'INP er kritisk langsom',
          description: `INP er ${perfDaily.inpPctl}ms. Reducer JavaScript-udførelse og optimer event handlers. Målet er under 200ms.`,
          metric: 'INP', value: perfDaily.inpPctl,
        })
      } else if (perfDaily.inpPctl > 200) {
        recommendations.push({
          id: 'perf-inp-warn',
          severity: 'important',
          category: 'performance',
          title: 'INP kan forbedres',
          description: `INP er ${perfDaily.inpPctl}ms. Overvej code splitting og at reducere main thread-belastning.`,
          metric: 'INP', value: perfDaily.inpPctl,
        })
      }
    }

    // Low perf score
    if (perfDaily.perfScoreAvg != null && perfDaily.perfScoreAvg < 50) {
      recommendations.push({
        id: 'perf-score-low',
        severity: 'critical',
        category: 'performance',
        title: 'Performance score er lav',
        description: `Performance score er ${perfDaily.perfScoreAvg}/100. Gennemgå PageSpeed Insights-rapporten for specifikke optimeringer.`,
        metric: 'Score', value: perfDaily.perfScoreAvg,
      })
    }
  }

  // === CRAWL RULES ===

  if (crawlReport) {
    const totals = crawlReport.totals as { errors?: number; warnings?: number; pages?: number } | null

    if (totals?.errors && totals.errors > 0) {
      recommendations.push({
        id: 'crawl-errors',
        severity: totals.errors > 5 ? 'critical' : 'important',
        category: 'technical',
        title: `${totals.errors} crawl-fejl fundet`,
        description: `Der blev fundet ${totals.errors} fejl under seneste crawl${totals.pages ? ` af ${totals.pages} sider` : ''}. Tjek Issues-fanen for detaljer.`,
      })
    }

    // Check for specific issue types in topIssues
    const topIssues = crawlReport.topIssues as Array<{ type?: string; count?: number }> | null
    if (topIssues) {
      const metaIssue = topIssues.find(i => i.type === 'missing_meta_description')
      if (metaIssue && (metaIssue.count ?? 0) > 0) {
        recommendations.push({
          id: 'crawl-meta-desc',
          severity: 'important',
          category: 'content',
          title: `${metaIssue.count} sider mangler meta description`,
          description: 'Meta descriptions hjælper søgemaskiner med at forstå sidens indhold og forbedrer CTR i søgeresultater.',
        })
      }

      const titleIssue = topIssues.find(i => i.type === 'missing_title')
      if (titleIssue && (titleIssue.count ?? 0) > 0) {
        recommendations.push({
          id: 'crawl-title',
          severity: 'critical',
          category: 'content',
          title: `${titleIssue.count} sider mangler title tag`,
          description: 'Title tags er afgørende for SEO. Hver side bør have en unik, beskrivende title.',
        })
      }
    }
  }

  // === GSC TREND RULES ===

  const currClicks = gscCurr._sum.clicks ?? 0
  const prevClicks = gscPrev._sum.clicks ?? 0
  const clickDelta = safePctDelta(currClicks, prevClicks)

  if (clickDelta < -20 && prevClicks > 10) {
    recommendations.push({
      id: 'gsc-clicks-drop',
      severity: clickDelta < -50 ? 'critical' : 'important',
      category: 'search',
      title: 'Klik er faldet markant',
      description: `Klik er faldet ${Math.abs(Math.round(clickDelta))}% i de seneste 30 dage. Undersøg om der er tekniske problemer eller indholdsændringer der påvirker synligheden.`,
      metric: 'Clicks', value: clickDelta,
    })
  }

  const currPos = gscCurr._avg.position ?? 0
  const prevPos = gscPrev._avg.position ?? 0
  if (prevPos > 0 && currPos > 0) {
    const posDelta = currPos - prevPos // positive = worse
    if (posDelta > 5) {
      recommendations.push({
        id: 'gsc-position-drop',
        severity: posDelta > 10 ? 'critical' : 'important',
        category: 'search',
        title: 'Gennemsnitlig position er faldet',
        description: `Gennemsnitlig position er steget fra ${prevPos.toFixed(1)} til ${currPos.toFixed(1)} (${posDelta.toFixed(1)} pladser dårligere). Overvej at opdatere indhold og forbedre backlinks.`,
        metric: 'Position', value: currPos,
      })
    }
  }

  // === KEYWORD-SPECIFIC RULES ===

  const prevKeywordMap = new Map(keywordsPrev.map(k => [k.query, k._avg.position ?? 0]))
  for (const kw of keywordsCurr) {
    const currPosition = kw._avg.position ?? 0
    const prevPosition = prevKeywordMap.get(kw.query)
    if (prevPosition && prevPosition > 0 && currPosition > 0) {
      const decline = ((currPosition - prevPosition) / prevPosition) * 100
      if (decline > 20 && (kw._sum.clicks ?? 0) > 5) {
        recommendations.push({
          id: `kw-decline-${kw.query.replace(/[^a-z0-9-]/gi, '-').slice(0, 40)}`,
          severity: decline > 50 ? 'critical' : 'important',
          category: 'search',
          title: `"${kw.query}" mister placering`,
          description: `Position faldet fra ${prevPosition.toFixed(1)} til ${currPosition.toFixed(1)} (${Math.round(decline)}% forværring). Overvej at opdatere indholdet.`,
          metric: 'Position', value: currPosition,
        })
        // Max 3 keyword-specific recommendations
        if (recommendations.filter(r => r.id.startsWith('kw-decline')).length >= 3) break
      }
    }
  }

  // Sort by severity
  const severityOrder: Record<Severity, number> = { critical: 0, important: 1, suggestion: 2 }
  recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return recommendations
}
