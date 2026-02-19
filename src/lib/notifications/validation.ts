import { NotificationChannelType } from '@prisma/client'
import { z } from 'zod'

export const SlackConfigSchema = z.object({
  webhookUrl: z.string().url().startsWith('https://hooks.slack.com/'),
  channel: z.string().optional(),
})

export const WebhookConfigSchema = z.object({
  url: z.string().url().startsWith('https://'),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
})

export function validateConfig(
  type: NotificationChannelType,
  config: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  if (type === 'SLACK') {
    const result = SlackConfigSchema.safeParse(config)
    if (!result.success) return { ok: false, error: 'Invalid Slack config: webhookUrl must be a valid Slack webhook URL' }
  } else if (type === 'WEBHOOK') {
    const result = WebhookConfigSchema.safeParse(config)
    if (!result.success) return { ok: false, error: 'Invalid webhook config: url must be a valid HTTPS URL' }
  }
  return { ok: true }
}
