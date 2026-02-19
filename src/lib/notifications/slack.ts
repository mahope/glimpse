import type { NotificationPayload } from './dispatcher'

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#ef4444',
}

export async function sendSlackNotification(
  config: Record<string, unknown>,
  payload: NotificationPayload,
) {
  const webhookUrl = config.webhookUrl as string | undefined
  if (!webhookUrl) throw new Error('Slack webhook URL is missing')

  // Validate URL format
  if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
    throw new Error('Invalid Slack webhook URL')
  }

  const color = SEVERITY_COLORS[payload.severity || 'info']
  const fields = (payload.fields || []).map(f => ({
    title: f.label,
    value: f.value,
    short: true,
  }))

  const body = {
    attachments: [
      {
        color,
        title: payload.title,
        text: payload.message,
        fields,
        ...(payload.url ? { title_link: payload.url } : {}),
        footer: 'Glimpse SEO Dashboard',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`Slack webhook responded with ${res.status}`)
  }
}
