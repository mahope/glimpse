import { test, expect } from '@playwright/test'

// These tests use the "mobile" project in playwright.config.ts (iPhone 14 viewport)
test.describe('Mobile responsive navigation', () => {
  test('dashboard loads on mobile viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test')
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/sign-in/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('sites page is usable on mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test')
    await page.goto('/sites')
    await expect(page.getByText('example.com').or(page.getByText('Example Website'))).toBeVisible({ timeout: 10_000 })
  })

  test('settings page is accessible on mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test')
    await page.goto('/settings/profile')
    await expect(page).not.toHaveURL(/sign-in/)
  })
})
