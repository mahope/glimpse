import React from 'react'
import type { KPI } from '@/lib/reports/types'

export function MonthlyReportEmail({ siteName, periodLabel }: { siteName: string; periodLabel: string }) {
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
      <h2>SEO Monthly Report</h2>
      <p>Your report for <b>{siteName}</b> — <b>{periodLabel}</b> is ready.</p>
      <p>We've attached a PDF with KPIs, trends, top keywords and issues summary.</p>
      <p style={{ color: '#6B7280', fontSize: 12 }}>This is an automated email from Glimpse.</p>
    </div>
  )
}

export function ReportEmailPreview({
  siteName,
  periodLabel,
  typeLabel,
  kpis,
  seoScore,
  reportUrl,
  brandColor,
}: {
  siteName: string
  periodLabel: string
  typeLabel: 'weekly' | 'monthly'
  kpis: KPI[]
  seoScore?: number
  reportUrl: string
  brandColor?: string | null
}) {
  const accent = brandColor || '#2563EB'
  const typeDa = typeLabel === 'weekly' ? 'Ugentlig' : 'Månedlig'
  const topKpis = kpis.slice(0, 3)

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ backgroundColor: accent, padding: '24px 32px', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ color: '#ffffff', fontSize: 20, margin: 0 }}>{typeDa} rapport</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: '4px 0 0' }}>{siteName} — {periodLabel}</p>
      </div>

      <div style={{ padding: '24px 32px', border: '1px solid #E5E7EB', borderTop: 'none' }}>
        {seoScore != null && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 4px' }}>SEO Score</p>
            <p style={{ fontSize: 36, fontWeight: 700, color: accent, margin: 0 }}>{seoScore}</p>
          </div>
        )}

        {topKpis.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <tbody>
              <tr>
                {topKpis.map((kpi, i) => (
                  <td key={i} style={{ textAlign: 'center', padding: '12px 8px', borderRight: i < topKpis.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 4px' }}>{kpi.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{typeof kpi.value === 'number' ? kpi.value.toLocaleString('da-DK') : kpi.value}</p>
                    {kpi.delta != null && (
                      <p style={{ fontSize: 12, color: kpi.delta >= 0 ? '#059669' : '#DC2626', margin: '4px 0 0' }}>
                        {kpi.delta >= 0 ? '+' : ''}{kpi.delta.toFixed(1)}%
                      </p>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <a
            href={reportUrl}
            style={{
              display: 'inline-block',
              backgroundColor: accent,
              color: '#ffffff',
              padding: '12px 32px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Se fuld rapport
          </a>
        </div>

        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
          PDF-rapporten er vedhæftet denne email.
        </p>
      </div>

      <div style={{ padding: '12px 32px', backgroundColor: '#F9FAFB', borderRadius: '0 0 8px 8px', border: '1px solid #E5E7EB', borderTop: 'none' }}>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>
          Denne email er sendt automatisk fra Glimpse.
        </p>
      </div>
    </div>
  )
}

export function WelcomeEmail({ name }: { name?: string }) {
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
      <h2>Welcome to Glimpse</h2>
      <p>{name ? `Hi ${name},` : 'Hi,'} thanks for joining Glimpse. We’ll keep track of your SEO performance and send you reports regularly.</p>
    </div>
  )
}

export function AlertEmail({ siteName, message }: { siteName: string; message: string }) {
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
      <h3>Alert for {siteName}</h3>
      <p>{message}</p>
      <p style={{ color: '#6B7280', fontSize: 12 }}>You are receiving this because you enabled alerts.</p>
    </div>
  )
}
