import { test, expect } from '@playwright/test'

test('loads the app and shows the Plan and Evaluate view tabs', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Plan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Evaluate' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Execute' })).toHaveCount(0)
})
