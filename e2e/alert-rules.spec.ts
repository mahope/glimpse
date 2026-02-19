import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

test.describe('Alert rules CRUD', () => {
  let siteId: string

  test.beforeAll(async () => {
    const prisma = new PrismaClient()
    try {
      const org = await prisma.organization.findUnique({ where: { slug: 'demo-company' } })
      const site = await prisma.site.findFirst({
        where: { organizationId: org!.id, domain: 'example.com' },
      })
      siteId = site!.id
    } finally {
      await prisma.$disconnect()
    }
  })

  test('navigates to alert settings', async ({ page }) => {
    await page.goto(`/sites/${siteId}/settings/alerts`)
    await expect(page).not.toHaveURL(/sign-in/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('creates a new alert rule via API', async ({ request }) => {
    const res = await request.post(`/api/sites/${siteId}/alerts/rules`, {
      data: {
        metric: 'LCP',
        device: 'MOBILE',
        threshold: 2500,
        windowDays: 1,
        enabled: true,
        recipients: ['test@example.com'],
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.metric).toBe('LCP')

    // Clean up
    const delRes = await request.delete(`/api/sites/${siteId}/alerts/rules?ruleId=${body.id}`)
    expect(delRes.ok()).toBeTruthy()
  })

  test('lists alert rules via API', async ({ request }) => {
    const res = await request.get(`/api/sites/${siteId}/alerts/rules`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.rules)).toBe(true)
  })
})
