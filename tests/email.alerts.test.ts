import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendEmail = vi.fn()

vi.mock('@/lib/email/client', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

import { sendAlertEmail } from '@/lib/email/alerts'

const mockSite = {
  id: 's1',
  name: 'Test Site',
  domain: 'test.com',
  url: 'https://test.com',
  organizationId: 'org1',
} as any

const mockRule = {
  id: 'r1',
  metric: 'LCP' as const,
  device: 'MOBILE' as const,
  threshold: 2500,
  recipients: ['alert@example.com'],
} as any

const mockEvent = {
  id: 'e1',
  value: 3200,
  date: new Date('2026-02-01'),
} as any

describe('sendAlertEmail', () => {
  beforeEach(() => {
    mockSendEmail.mockReset()
    mockSendEmail.mockResolvedValue({ id: 'msg-1' })
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.glimpse.local'
  })

  it('sends email to rule recipients', async () => {
    await sendAlertEmail(mockSite, mockRule, mockEvent)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.to).toEqual(['alert@example.com'])
  })

  it('includes metric and site name in subject', async () => {
    await sendAlertEmail(mockSite, mockRule, mockEvent)
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).toContain('Test Site')
    expect(call.subject).toContain('LCP')
  })

  it('includes threshold and observed value in HTML', async () => {
    await sendAlertEmail(mockSite, mockRule, mockEvent)
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain('2500')
    expect(call.html).toContain('3200')
  })

  it('falls back to owner emails when rule has no recipients', async () => {
    const ruleNoRecipients = { ...mockRule, recipients: [] }
    await sendAlertEmail(mockSite, ruleNoRecipients, mockEvent, ['owner@example.com'])
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.to).toEqual(['owner@example.com'])
  })

  it('falls back to ALERTS_FALLBACK_EMAIL when no owners', async () => {
    process.env.ALERTS_FALLBACK_EMAIL = 'fallback@example.com'
    const ruleNoRecipients = { ...mockRule, recipients: [] }
    await sendAlertEmail(mockSite, ruleNoRecipients, mockEvent, [])
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.to).toEqual(['fallback@example.com'])
    delete process.env.ALERTS_FALLBACK_EMAIL
  })

  it('includes dashboard link in HTML', async () => {
    await sendAlertEmail(mockSite, mockRule, mockEvent)
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain(`/sites/s1/settings/alerts`)
  })
})
