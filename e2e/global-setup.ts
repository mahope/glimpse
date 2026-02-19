import { test as setup, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Global setup: creates a test session directly in the database,
 * then stores the session cookie so all tests run authenticated.
 */
setup('authenticate', async ({ page }) => {
  const prisma = new PrismaClient()

  try {
    // Ensure demo data exists (seed should have been run beforehand)
    const user = await prisma.user.findUnique({ where: { email: 'admin@glimpse.dev' } })
    if (!user) throw new Error('Seed data missing — run npm run db:seed first')

    const org = await prisma.organization.findUnique({ where: { slug: 'demo-company' } })
    if (!org) throw new Error('Seed data missing — no demo-company org')

    // Create a fresh session token
    const sessionToken = randomUUID()
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
        activeOrganizationId: org.id,
      },
    })

    // Set the session cookie in the browser
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        expires: Math.floor(expires.getTime() / 1000),
      },
    ])

    // Verify the session works by navigating to dashboard
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/sign-in/)
  } finally {
    await prisma.$disconnect()
  }

  // Save auth state for reuse in all tests
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})
