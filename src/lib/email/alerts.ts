import { AlertEvent, AlertMetric, AlertRule, PerfDevice, Site } from '@prisma/client'
import { sendEmail } from './client'

function metricLabel(m: AlertMetric) {
  switch (m) {
    case 'LCP': return 'LCP p75'
    case 'INP': return 'INP p75'
    case 'CLS': return 'CLS p75'
    case 'SCORE_DROP': return 'Performance score drop'
  }
}

function deviceLabel(d: PerfDevice) {
  return d.toLowerCase()
}

export async function sendAlertEmail(site: Site, rule: AlertRule, event: AlertEvent, ownerFallback?: string[]) {
  const m = metricLabel(rule.metric)
  const d = deviceLabel(rule.device)
  const subject = `Glimpse Alert • ${site.name} • ${m} (${d})`
  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.glimpse.local'}/sites/${site.id}/settings/alerts`

  const html = `
    <div style="font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:auto;padding:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div style="width:8px;height:8px;border-radius:9999px;background:#ef4444"></div>
        <strong>Glimpse Alert</strong>
      </div>
      <h2 style="margin:0 0 12px 0;font-size:18px">${site.name}</h2>
      <p style="margin:0 0 8px 0">${m} on <strong>${d}</strong> exceeded threshold.</p>
      <ul style="margin:0 0 12px 16px;padding:0">
        <li>Threshold: <strong>${rule.threshold}</strong></li>
        <li>Observed: <strong>${event.value}</strong> on ${new Date(event.date).toDateString()}</li>
      </ul>
      <p><a href="${dashUrl}" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none">Open Alerts</a></p>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">You received this because you are listed as a recipient for this rule.</p>
    </div>
  `

  const to = rule.recipients.length ? rule.recipients : (ownerFallback && ownerFallback.length ? ownerFallback : [process.env.ALERTS_FALLBACK_EMAIL || 'alerts@example.com'])
  await sendEmail({ to, subject, html })
}
