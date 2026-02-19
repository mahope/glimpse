import { prisma } from '@/lib/db'
import { endOfDay, startOfDay, subDays, format } from 'date-fns'
import type { ReportData, ReportSectionKey } from './types'
import { REPORT_SECTION_KEYS } from './types'

interface SiteWithOrg {
  id: string
  name: string
  domain: string
  url: string
  organization: {
    name: string
    logo: string | null
    brandColor?: string | null
    reportHeaderText?: string | null
    reportFooterText?: string | null
    hideGlimpseBrand?: boolean
  }
}

export async function buildReportData(site: SiteWithOrg, sections?: ReportSectionKey[]): Promise<ReportData> {
  const activeSections = sections && sections.length > 0 ? sections : [...REPORT_SECTION_KEYS]
  const to = endOfDay(new Date())
  const from = startOfDay(subDays(to, 30))
  const periodLabel = `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`

  const [seoScore, perfSnap, gscData, crawlResult] = await Promise.all([
    prisma.seoScore.findFirst({
      where: { siteId: site.id, date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
    }),
    prisma.perfSnapshot.findFirst({
      where: { siteId: site.id },
      orderBy: { date: 'desc' },
    }),
    prisma.searchStatDaily.findMany({
      where: { siteId: site.id, date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
      take: 300,
    }),
    prisma.crawlResult.findFirst({
      where: { siteId: site.id },
      orderBy: { crawlDate: 'desc' },
    }),
  ])

  const queries = gscData.filter(r => !!r.query)
  const topKeywords = Object.values(
    queries.reduce((acc, r) => {
      const key = r.query || ''
      if (!acc[key]) acc[key] = { keyword: key, clicks: 0, impressions: 0, ctr: 0, position: 0, n: 0 }
      acc[key].clicks += r.clicks
      acc[key].impressions += r.impressions
      acc[key].ctr += r.ctr
      acc[key].position += r.position
      acc[key].n += 1
      return acc
    }, {} as Record<string, { keyword: string; clicks: number; impressions: number; ctr: number; position: number; n: number }>)
  )
    .map(k => ({ keyword: k.keyword, clicks: k.clicks, impressions: k.impressions, ctr: k.ctr / k.n, position: k.position / k.n }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)

  const totals = gscData.reduce((acc, r) => {
    acc.clicks += r.clicks
    acc.impressions += r.impressions
    acc.ctr += r.ctr
    acc.position += r.position
    acc.n += 1
    return acc
  }, { clicks: 0, impressions: 0, ctr: 0, position: 0, n: 0 })

  const kpis = [
    { label: 'Clicks', value: totals.clicks },
    { label: 'Impressions', value: totals.impressions },
    { label: 'Avg. Position', value: totals.n ? (totals.position / totals.n).toFixed(1) : '-' },
    { label: 'CTR', value: totals.n ? `${((totals.ctr / totals.n) * 100).toFixed(1)}%` : '-' },
  ]

  const trendsMap = new Map<string, { date: string; clicks: number; impressions: number; position: number; ctr: number; n: number }>()
  gscData.forEach(r => {
    const d = new Date(r.date)
    const key = format(d, 'yyyy-MM-dd')
    const it = trendsMap.get(key) || { date: key, clicks: 0, impressions: 0, position: 0, ctr: 0, n: 0 }
    it.clicks += r.clicks
    it.impressions += r.impressions
    it.position += r.position
    it.ctr += r.ctr
    it.n += 1
    trendsMap.set(key, it)
  })
  const trends = Array.from(trendsMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => ({ date: t.date, clicks: t.clicks, impressions: t.impressions, position: t.n ? t.position / t.n : 0, ctr: t.n ? t.ctr / t.n : 0 }))

  const has = (key: ReportSectionKey) => activeSections.includes(key)

  const org = site.organization
  return {
    site: { id: site.id, name: site.name, domain: site.domain, url: site.url, organization: { name: org.name, logo: org.logo } },
    branding: {
      brandColor: org.brandColor,
      headerText: org.reportHeaderText,
      footerText: org.reportFooterText,
      hideGlimpseBrand: org.hideGlimpseBrand ?? false,
    },
    period: { from: from.toISOString(), to: to.toISOString(), label: periodLabel },
    generatedAt: new Date().toISOString(),
    seoScore: seoScore?.score ?? undefined,
    sections: activeSections,
    kpis: has('kpis') ? kpis : [],
    performance: has('performance') && perfSnap ? {
      lcp: perfSnap.lcpMs != null ? perfSnap.lcpMs / 1000 : undefined,
      inp: perfSnap.inpMs != null ? perfSnap.inpMs : undefined,
      cls: perfSnap.cls ?? undefined,
      ttfb: perfSnap.ttfbMs != null ? perfSnap.ttfbMs : undefined,
    } : undefined,
    topKeywords: has('keywords') ? topKeywords : undefined,
    issues: has('crawl') && Array.isArray(crawlResult?.issues) ? crawlResult.issues as any[] : undefined,
    trends: has('kpis') ? trends : undefined,
  }
}
