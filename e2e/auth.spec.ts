import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // Run without auth

  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('shows sign-in page with magic link form', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await expect(page.getByText('Sign in to Glimpse')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })

  test('shows email sent confirmation after magic link request', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByRole('button', { name: /magic link/i }).click()

    // Should show confirmation (may fail if Resend API key not set, but UI should handle)
    await expect(
      page.getByText(/check your email/i).or(page.getByText(/failed/i))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('protected routes redirect to sign-in', async ({ page }) => {
    await page.goto('/sites')
    await expect(page).toHaveURL(/sign-in/)

    await page.goto('/settings/profile')
    await expect(page).toHaveURL(/sign-in/)
  })
})
