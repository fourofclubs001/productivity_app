import { test, expect } from '@playwright/test'

test('loads the app and shows the three view tabs', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Plan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Execute' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Evaluate' })).toBeVisible()
})
