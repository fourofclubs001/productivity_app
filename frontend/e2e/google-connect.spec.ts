import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

test('connect and disconnect Google Calendar via the fake adapter', async ({ page, request }) => {
  // The connection is a single global toggle, not per-fixture-name isolated
  // like tasks/intervals -- force a known disconnected starting state
  // regardless of what an earlier spec in this same run left it as (global
  // setup only flushes Redis once per whole run, not per spec).
  await request.post(`${API_BASE}/auth/google/disconnect`)

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
