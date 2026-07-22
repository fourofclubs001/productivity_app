import { test, expect } from '@playwright/test'
import { todayAt } from './helpers/time'

const API_BASE = 'http://localhost:8001'

test('pushing a pre-existing interval to Google Calendar removes the option once synced', async ({
  page,
  request,
}) => {
  const taskName = `PreConnect ${Date.now()}`
  const task = await (
    await request.post(`${API_BASE}/tasks`, {
      data: { name: taskName, definition_of_done: 'done' },
    })
  ).json()

  const start = todayAt(11)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
  })

  await page.goto('/')

  const event = page.locator('.rbc-event', { hasText: taskName })
  await expect(event).toBeVisible()

  // Not connected yet -- the interval predates the connection, so the
  // context menu should not offer to push it to Google.
  await event.click({ button: 'right' })
  await expect(page.getByRole('button', { name: 'Add to Google Calendar' })).not.toBeVisible()
  // Close the context menu by clicking its full-screen overlay (it has no
  // Escape-key handler -- only the overlay's onClick closes it).
  await page.mouse.click(10, 10)

  await page.getByRole('link', { name: 'Connect Google Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Google Calendar connected' })).toBeVisible()

  await event.click({ button: 'right' })
  await page.getByRole('button', { name: 'Add to Google Calendar' }).click()

  // Once synced, the option disappears on a subsequent right-click.
  await expect(event).toBeVisible()
  await event.click({ button: 'right' })
  await expect(page.getByRole('button', { name: 'Add to Google Calendar' })).not.toBeVisible()
})
