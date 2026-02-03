import React from 'react'

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
