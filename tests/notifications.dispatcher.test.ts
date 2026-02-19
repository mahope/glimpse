import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockSlack = vi.fn()
const mockWebhook = vi.fn()

vi.mock('@prisma/client', () => ({
  NotificationChannelType: { SLACK: 'SLACK', WEBHOOK: 'WEBHOOK' },
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    notificationChannel: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

vi.mock('@/lib/notifications/slack', () => ({
  sendSlackNotification: (...args: unknown[]) => mockSlack(...args),
}))

vi.mock('@/lib/notifications/webhook', () => ({
  sendWebhookNotification: (...args: unknown[]) => mockWebhook(...args),
}))

import { dispatchNotification } from '@/lib/notifications/dispatcher'

describe('dispatchNotification', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
    mockSlack.mockReset()
    mockWebhook.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('dispatches to Slack channels', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'ch1', type: 'SLACK', config: { webhookUrl: 'https://hooks.slack.com/test' }, events: ['alert'] },
    ])
    mockSlack.mockResolvedValue(undefined)

    const result = await dispatchNotification('org1', {
      event: 'alert',
      title: 'Test',
      message: 'Test message',
    })

    expect(mockSlack).toHaveBeenCalledTimes(1)
    expect(result.total).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('dispatches to webhook channels', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'ch2', type: 'WEBHOOK', config: { url: 'https://example.com/webhook' }, events: ['alert'] },
    ])
    mockWebhook.mockResolvedValue(undefined)

    const result = await dispatchNotification('org1', {
      event: 'alert',
      title: 'Test',
      message: 'Test message',
    })

    expect(mockWebhook).toHaveBeenCalledTimes(1)
    expect(result.total).toBe(1)
  })

  it('counts failures without throwing', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'ch1', type: 'SLACK', config: {}, events: ['alert'] },
      { id: 'ch2', type: 'WEBHOOK', config: {}, events: ['alert'] },
    ])
    mockSlack.mockRejectedValue(new Error('Slack failed'))
    mockWebhook.mockResolvedValue(undefined)

    const result = await dispatchNotification('org1', {
      event: 'alert',
      title: 'Test',
      message: 'Test message',
    })

    expect(result.total).toBe(2)
    expect(result.failed).toBe(1)
  })

  it('returns zero when no channels match', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await dispatchNotification('org1', {
      event: 'report',
      title: 'Test',
      message: 'Test message',
    })

    expect(result.total).toBe(0)
    expect(result.failed).toBe(0)
  })
})
