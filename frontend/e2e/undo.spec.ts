import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

test('right-click deletes a scheduled interval, and ctrl+z restores it', async ({
  page,
  request,
}) => {
  const taskName = `Undo test ${Date.now()}`
  const task = await (
    await request.post(`${API_BASE}/tasks`, {
      data: { name: taskName, definition_of_done: 'done' },
    })
  ).json()

  const start = new Date()
  start.setUTCHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setUTCHours(11, 0, 0, 0)
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
  })

  await page.goto('/')

  const event = page.locator('.rbc-event', { hasText: taskName })
  await expect(event).toBeVisible()

  await event.click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(event).not.toBeVisible()

  await page.keyboard.press('Control+z')
  await expect(page.locator('.rbc-event', { hasText: taskName })).toBeVisible()
})
