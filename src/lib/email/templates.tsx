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

export function WeeklyDigestEmail({
  organizationName,
  periodLabel,
  sites,
  totalAlerts,
  dashboardUrl,
}: {
  organizationName: string
  periodLabel: string
  sites: Array<{
    siteName: string
    domain: string
    seoScore: number | null
    seoScoreChange: number | null
    topMovers: Array<{ keyword: string; positionChange: number; direction: 'up' | 'down' }>
    newAlertCount: number
    topRecommendation: string | null
  }>
  totalAlerts: number
  dashboardUrl: string
}) {
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ backgroundColor: '#2563EB', padding: '24px 32px', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ color: '#ffffff', fontSize: 20, margin: 0 }}>Ugentlig SEO-oversigt</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: '4px 0 0' }}>
          {organizationName} — {periodLabel}
        </p>
      </div>

      <div style={{ padding: '24px 32px', border: '1px solid #E5E7EB', borderTop: 'none' }}>
        {totalAlerts > 0 && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '12px 16px', marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#991B1B' }}>
              <strong>{totalAlerts} nye alerts</strong> denne uge på tværs af dine sites
            </p>
          </div>
        )}

        {sites.map((site, idx) => (
          <div key={idx} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: idx < sites.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>{site.siteName}</h2>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{site.domain}</span>
            </div>

            {site.seoScore != null && (
              <p style={{ fontSize: 14, margin: '0 0 8px' }}>
                SEO Score: <strong>{site.seoScore}</strong>
                {site.seoScoreChange != null && site.seoScoreChange !== 0 && (
                  <span style={{ color: site.seoScoreChange > 0 ? '#059669' : '#DC2626', marginLeft: 8 }}>
                    {site.seoScoreChange > 0 ? '+' : ''}{site.seoScoreChange} point
                  </span>
                )}
              </p>
            )}

            {site.topMovers.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 4px' }}>Største keyword-bevægelser:</p>
                {site.topMovers.map((mover, mi) => (
                  <p key={mi} style={{ fontSize: 13, margin: '2px 0', paddingLeft: 8 }}>
                    <span style={{ color: mover.direction === 'up' ? '#059669' : '#DC2626' }}>
                      {mover.direction === 'up' ? '▲' : '▼'} {Math.abs(mover.positionChange)} pos.
                    </span>
                    {' '}<span style={{ color: '#374151' }}>{mover.keyword}</span>
                  </p>
                ))}
              </div>
            )}

            {site.newAlertCount > 0 && (
              <p style={{ fontSize: 13, margin: '4px 0', color: '#DC2626' }}>
                {site.newAlertCount} nye alerts
              </p>
            )}

            {site.topRecommendation && (
              <p style={{ fontSize: 13, margin: '4px 0', color: '#6B7280' }}>
                Vigtigste anbefaling: <em>{site.topRecommendation}</em>
              </p>
            )}
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a
            href={dashboardUrl}
            style={{
              display: 'inline-block',
              backgroundColor: '#2563EB',
              color: '#ffffff',
              padding: '12px 32px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Gå til dashboard
          </a>
        </div>
      </div>

      <div style={{ padding: '12px 32px', backgroundColor: '#F9FAFB', borderRadius: '0 0 8px 8px', border: '1px solid #E5E7EB', borderTop: 'none' }}>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>
          Denne ugentlige oversigt er sendt automatisk fra Glimpse. Du kan slå den fra under Indstillinger.
        </p>
      </div>
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
