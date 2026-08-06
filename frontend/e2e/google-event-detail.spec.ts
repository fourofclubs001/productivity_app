import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

// Seeding a real pulled event through the fake Google adapter isn't possible
// from outside the backend process (FakeGoogleCalendarClient's events list
// is only ever populated via pytest's dependency_overrides) -- intercepting
// the frontend's own /google/events fetch is the practical way to exercise
// this click-to-open-panel behavior end-to-end without backend changes.
async function mockPulledEvent(page: import('@playwright/test').Page, title: string) {
  const start = new Date()
  start.setHours(start.getHours() + 1, 0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  await page.route('**/google/events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'ext-e2e-1',
          title,
          start: start.toISOString(),
          end: end.toISOString(),
          description: 'Bring insurance card',
        },
      ]),
    })
  })
}

test('clicking a pulled Google Calendar event opens a read-only detail panel on Plan and Execute', async ({
  page,
  request,
}) => {
  // Connection is a single global toggle, not per-fixture-name isolated --
  // force a known disconnected starting state first (see google-connect.spec.ts).
  await request.post(`${API_BASE}/auth/google/disconnect`)

  const title = `Pulled event ${Date.now()}`
  await page.goto('/')
  await mockPulledEvent(page, title)

  await page.getByRole('link', { name: 'Connect Google Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Google Calendar connected' })).toBeVisible()

  // Plan: clicking the chip opens the read-only panel.
  await expect(page.getByText(title)).toBeVisible()
  await page.getByText(title).click()
  await expect(page.getByTestId('google-event-detail-panel')).toBeVisible()
  await expect(page.getByText('Bring insurance card')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('google-event-detail-panel')).not.toBeVisible()

  // Execute: same event, same panel.
  await page.getByRole('button', { name: 'Execute' }).click()
  await expect(page.getByText(title)).toBeVisible()
  await page.getByText(title).click()
  await expect(page.getByTestId('google-event-detail-panel')).toBeVisible()
  await expect(page.getByText('Bring insurance card')).toBeVisible()
})
