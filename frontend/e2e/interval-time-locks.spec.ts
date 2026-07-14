import { test, expect } from '@playwright/test'
import { todayAt } from './helpers/time'

const API_BASE = 'http://localhost:8001'

// Past and in-progress lock states are covered at the backend pytest level
// (test_intervals.py) -- they require seeding an interval with a start time
// already in the past, which the app's public API can no longer do at all
// (see v02 item 8's "no past-dated intervals" guard), so there's no way to
// set that fixture up through the real HTTP surface an E2E spec drives.
// This spec covers what's actually reachable through the UI: a
// fully-future interval's "Edit time" flow.
test('editing a scheduled interval time via the right-click context menu', async ({
  page,
  request,
}) => {
  const taskName = `EditTime ${Date.now()}`
  const task = await (
    await request.post(`${API_BASE}/tasks`, {
      data: { name: taskName, definition_of_done: 'done' },
    })
  ).json()

  const start = todayAt(9)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
  })

  await page.goto('/')

  const event = page.locator('.rbc-event', { hasText: taskName })
  await expect(event).toBeVisible()

  await event.click({ button: 'right' })
  await page.getByRole('button', { name: 'Edit time' }).click()

  await expect(page.getByRole('heading', { name: 'Edit time' })).toBeVisible()
  // Pre-filled with the interval's current start/end, not blank.
  await expect(page.getByLabel('Start hour')).not.toHaveValue('')
  await expect(page.getByLabel('End hour')).not.toHaveValue('')

  await page.getByLabel('Start hour').fill('23:00')
  await page.getByLabel('End hour').fill('23:30')
  await page.locator('form').getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { name: 'Edit time' })).not.toBeVisible()

  const listResponse = await request.get(`${API_BASE}/intervals/by-task/${task.id}`)
  const [interval] = await listResponse.json()
  expect(interval.start).not.toBe(start.toISOString())
})
