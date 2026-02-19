import { prisma } from '@/lib/db'
import { NotificationChannelType } from '@prisma/client'
import { sendSlackNotification } from './slack'
import { sendWebhookNotification } from './webhook'

export type NotificationEvent = 'alert' | 'report' | 'uptime'

export interface NotificationPayload {
  event: NotificationEvent
  title: string
  message: string
  url?: string
  severity?: 'info' | 'warning' | 'critical'
  fields?: { label: string; value: string }[]
}

/** Dispatch a notification to all enabled channels for the given organization and event type */
export async function dispatchNotification(organizationId: string, payload: NotificationPayload) {
  const channels = await prisma.notificationChannel.findMany({
    where: {
      organizationId,
      enabled: true,
      events: { has: payload.event },
    },
  })

  const results = await Promise.allSettled(
    channels.map(channel => {
      switch (channel.type) {
        case NotificationChannelType.SLACK:
          return sendSlackNotification(channel.config as Record<string, unknown>, payload)
        case NotificationChannelType.WEBHOOK:
          return sendWebhookNotification(channel.config as Record<string, unknown>, payload)
        default: {
          const _exhaustive: never = channel.type
          throw new Error(`Unknown notification channel type: ${_exhaustive}`)
        }
      }
    })
  )

  const failures = results.filter(r => r.status === 'rejected')
  if (failures.length > 0) {
    console.error(`[notifications] ${failures.length}/${channels.length} channel(s) failed for org ${organizationId}`)
  }

  return { total: channels.length, failed: failures.length }
}

/** Send a test notification to a specific channel config (not saved) */
export async function sendTestNotification(
  type: NotificationChannelType,
  config: Record<string, unknown>,
) {
  const payload: NotificationPayload = {
    event: 'alert',
    title: 'Glimpse Test Notification',
    message: 'Dette er en test-notifikation fra Glimpse. Hvis du kan se denne besked, virker din integration!',
    severity: 'info',
    fields: [
      { label: 'Type', value: type },
      { label: 'Tidspunkt', value: new Date().toLocaleString('da-DK') },
    ],
  }

  switch (type) {
    case NotificationChannelType.SLACK:
      return sendSlackNotification(config, payload)
    case NotificationChannelType.WEBHOOK:
      return sendWebhookNotification(config, payload)
    default: {
      const _exhaustive: never = type
      throw new Error(`Unknown notification channel type: ${_exhaustive}`)
    }
  }
}
