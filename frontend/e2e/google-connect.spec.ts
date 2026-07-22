import { test, expect } from '@playwright/test'

test('connect and disconnect Google Calendar via the fake adapter', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Connect Google Calendar' })).toBeVisible()

  // Dev stack runs with no real Google credentials configured, so the backend
  // transparently uses its in-process fake OAuth client -- this whole flow
  // (login -> our own callback -> redirect back into the SPA) never reaches
  // real Google, and is fully deterministic.
  await page.getByRole('link', { name: 'Connect Google Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Google Calendar connected' })).toBeVisible()

  await page.getByRole('button', { name: 'Google Calendar connected' }).click()
  await expect(page.getByText(/Disconnect Google Calendar\?/)).toBeVisible()
  await page.getByRole('button', { name: 'Disconnect' }).click()

  await expect(page.getByRole('link', { name: 'Connect Google Calendar' })).toBeVisible()
})
