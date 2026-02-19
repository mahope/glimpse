import { createHmac } from 'crypto'
import dns from 'dns/promises'
import type { NotificationPayload } from './dispatcher'

const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
]

const BLOCKED_HOSTNAMES = ['localhost']
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost']

const PROTECTED_HEADERS = new Set([
  'host', 'content-type', 'user-agent', 'x-glimpse-signature',
  'content-length', 'transfer-encoding', 'connection',
])

async function validateWebhookTarget(rawUrl: string): Promise<void> {
  const parsed = new URL(rawUrl)
  const hostname = parsed.hostname

  if (BLOCKED_HOSTNAMES.includes(hostname) || BLOCKED_SUFFIXES.some(s => hostname.endsWith(s))) {
    throw new Error('Webhook URL must not target internal hosts')
  }

  try {
    const { address } = await dns.lookup(hostname)
    if (BLOCKED_IP_PATTERNS.some(re => re.test(address))) {
      throw new Error('Webhook URL resolves to a private/reserved IP address')
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('private/reserved')) throw err
    throw new Error(`Could not resolve webhook hostname: ${hostname}`)
  }
}

export async function sendWebhookNotification(
  config: Record<string, unknown>,
  payload: NotificationPayload,
) {
  const url = config.url as string | undefined
  if (!url) throw new Error('Webhook URL is missing')

  if (!url.startsWith('https://')) {
    throw new Error('Webhook URL must use HTTPS')
  }

  await validateWebhookTarget(url)

  const customHeaders = (config.headers as Record<string, string>) || {}
  const secret = config.secret as string | undefined

  const body = JSON.stringify({
    event: payload.event,
    title: payload.title,
    message: payload.message,
    severity: payload.severity || 'info',
    url: payload.url,
    fields: payload.fields || [],
    timestamp: new Date().toISOString(),
  })

  // Sanitize custom headers — block protected ones
  const sanitizedHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(customHeaders)) {
    if (!PROTECTED_HEADERS.has(key.toLowerCase())) {
      sanitizedHeaders[key] = value
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Glimpse-Webhook/1.0',
    ...sanitizedHeaders,
  }

  // HMAC signature if secret is configured
  if (secret) {
    const signature = createHmac('sha256', secret).update(body).digest('hex')
    headers['X-Glimpse-Signature'] = signature
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`Webhook responded with ${res.status}`)
  }
}
