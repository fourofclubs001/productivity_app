import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done' },
  })
  return response.json()
}

async function dragTaskOntoCalendar(page: Page, taskName: string) {
  const row = page.getByTestId('task-tree').locator('.group', { hasText: taskName })
  await row.scrollIntoViewIfNeeded()
  const rowBox = await row.boundingBox()
  const daySlot = page.locator('.rbc-day-slot').last()
  const slotBox = await daySlot.boundingBox()
  if (!rowBox || !slotBox) throw new Error('row or day-slot bounding box not found')

  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + 300, { steps: 10 })
  await page.mouse.up()
}

test('a newly scheduled interval auto-syncs to Google once connected, and deleting it succeeds', async ({
  page,
  request,
}) => {
  // Force a known disconnected starting state -- see google-connect.spec.ts's
  // comment (single global toggle, not flushed between specs).
  await request.post(`${API_BASE}/auth/google/disconnect`)

  const task = await createTask(request, `AutoSync ${Date.now()}`)

  await page.goto('/')
  await page.getByRole('link', { name: 'Connect Google Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Google Calendar connected' })).toBeVisible()

  await dragTaskOntoCalendar(page, task.name)
  const event = page.locator('.rbc-event', { hasText: task.name })
  await expect(event).toBeVisible()

  await expect
    .poll(async () => {
      const intervals = await (await request.get(`${API_BASE}/intervals/by-task/${task.id}`)).json()
      return intervals[0]?.google_event_id ?? null
    })
    .toEqual(expect.stringContaining('fake-event-'))

  // Deleting a synced interval should succeed with no error dialog.
  await event.click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(event).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'OK' })).not.toBeVisible()
})
