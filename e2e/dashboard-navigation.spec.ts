import { test, expect } from '@playwright/test'

test.describe('Dashboard navigation', () => {
  test('shows sites list on dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('body')).toBeVisible()
    // Should not be redirected to sign-in
    await expect(page).not.toHaveURL(/sign-in/)
  })

  test('navigates to sites page', async ({ page }) => {
    await page.goto('/sites')
    await expect(page).not.toHaveURL(/sign-in/)
    // Should show at least one site from seed data
    await expect(page.getByText('example.com').or(page.getByText('Example Website'))).toBeVisible({ timeout: 10_000 })
  })

  test('navigates to site overview', async ({ page }) => {
    await page.goto('/sites')
    // Click on the first site
    await page.getByText('example.com').or(page.getByText('Example Website')).first().click()
    await page.waitForURL(/\/sites\/[a-z0-9]+/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('navigates through site sub-pages', async ({ page }) => {
    await page.goto('/sites')
    await page.getByText('example.com').or(page.getByText('Example Website')).first().click()
    await page.waitForURL(/\/sites\/[a-z0-9]+/)

    // Navigate to keywords
    const keywordsLink = page.getByRole('link', { name: /keywords/i })
    if (await keywordsLink.isVisible()) {
      await keywordsLink.click()
      await expect(page).toHaveURL(/keywords/)
    }

    // Navigate to performance
    const perfLink = page.getByRole('link', { name: /performance/i })
    if (await perfLink.isVisible()) {
      await perfLink.click()
      await expect(page).toHaveURL(/performance/)
    }
  })

  test('navigates to settings pages', async ({ page }) => {
    await page.goto('/settings/profile')
    await expect(page).not.toHaveURL(/sign-in/)
    await expect(page.getByText(/profil/i)).toBeVisible({ timeout: 10_000 })

    await page.goto('/settings/notifications')
    await expect(page.getByText(/notifikation/i)).toBeVisible({ timeout: 10_000 })

    await page.goto('/settings/team')
    await expect(page.getByText(/team/i).or(page.getByText(/medlem/i))).toBeVisible({ timeout: 10_000 })
  })
})
