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

export async function sendAlertEmail(site: Site, rule: AlertRule, event: AlertEvent) {
  const m = metricLabel(rule.metric)
  const d = deviceLabel(rule.device)
  const subject = `Alert • ${site.name} • ${m} on ${d}`
  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.glimpse.local'}/sites/${site.id}/alerts`

  const html = `
    <p><strong>${site.name}</strong></p>
    <p>${m} (${d}) threshold ${rule.threshold} triggered with value ${event.value} on ${new Date(event.date).toDateString()}.</p>
    <p><a href="${dashUrl}">Open dashboard</a></p>
  `

  const to = rule.recipients.length ? rule.recipients : [process.env.ALERTS_FALLBACK_EMAIL || 'alerts@example.com']
  await sendEmail({ to, subject, html })
}
