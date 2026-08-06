import { test, expect } from '@playwright/test'

test('opens and closes the Configuration dialog from the nav bar', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Configuration')).not.toBeVisible()

  await page.getByRole('button', { name: 'Configuration' }).click()
  await expect(page.getByText('Configuration')).toBeVisible()
  await expect(page.getByText('No settings yet.')).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Configuration')).not.toBeVisible()
})
