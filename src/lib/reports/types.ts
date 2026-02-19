// Types for PDF report generation
export type KPI = {
  label: string
  value: number | string
  delta?: number // % change vs prev period
  helpText?: string
}

export type CoreWebVitals = {
  lcp?: number // seconds
  inp?: number // ms
  cls?: number
  ttfb?: number // ms
}

export type KeywordRow = {
  keyword: string
  clicks: number
  impressions: number
  ctr: number // 0-1
  position: number
}

export type Issue = {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  pagesAffected?: number
  description?: string
}

export type TrendPoint = {
  date: string // ISO
  clicks: number
  impressions: number
  position: number
  ctr: number // 0-1
}

export const REPORT_SECTION_KEYS = ['kpis', 'keywords', 'performance', 'crawl'] as const
export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number]

export const REPORT_SECTION_LABELS: Record<ReportSectionKey, string> = {
  kpis: 'KPI-oversigt',
  keywords: 'Top keywords',
  performance: 'Core Web Vitals',
  crawl: 'Crawl-problemer',
}

export type ReportSection =
  | { type: 'kpis'; data: KPI[] }
  | { type: 'performance'; data: CoreWebVitals }
  | { type: 'keywords'; data: KeywordRow[] }
  | { type: 'issues'; data: Issue[] }
  | { type: 'trends'; data: TrendPoint[] }

export type ReportBranding = {
  brandColor?: string | null
  headerText?: string | null
  footerText?: string | null
  hideGlimpseBrand?: boolean
}

export type ReportData = {
  site: {
    id: string
    name: string
    domain: string
    url: string
    logoUrl?: string | null
    organization?: { name: string; logo?: string | null } | null
  }
  branding?: ReportBranding
  period: { from: string; to: string; label: string }
  generatedAt: string
  seoScore?: number // 0-100
  sections?: ReportSectionKey[]
  kpis: KPI[]
  performance?: CoreWebVitals
  topKeywords?: KeywordRow[]
  issues?: Issue[]
  trends?: TrendPoint[]
}
