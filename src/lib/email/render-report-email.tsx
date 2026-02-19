import { renderToStaticMarkup } from 'react-dom/server'
import { ReportEmailPreview } from './templates'
import type { KPI } from '@/lib/reports/types'

export function renderReportEmailHtml(props: {
  siteName: string
  periodLabel: string
  typeLabel: 'weekly' | 'monthly'
  kpis: KPI[]
  seoScore?: number
  reportUrl: string
  brandColor?: string | null
}): string {
  const markup = renderToStaticMarkup(<ReportEmailPreview {...props} />)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:16px;background:#f3f4f6">${markup}</body></html>`
}
