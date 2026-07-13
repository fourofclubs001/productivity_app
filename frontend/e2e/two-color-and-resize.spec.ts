import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

test('a task with two colors renders a diagonal split chip on the calendar', async ({
  page,
  request,
}) => {
  const task = await (
    await request.post(`${API_BASE}/tasks`, {
      data: { name: `TwoColor ${Date.now()}`, definition_of_done: 'done', colors: ['red', 'blue'] },
    })
  ).json()

  const start = new Date()
  start.setUTCHours(9, 0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
  })

  await page.goto('/')
  const eventEl = page.locator('.rbc-event', { hasText: task.name })
  await expect(eventEl).toBeVisible()

  const background = await eventEl.evaluate((el) => getComputedStyle(el).backgroundImage)
  expect(background).toContain('linear-gradient')
})

test('dragging the panel resize handle changes the left panel width and it persists', async ({
  page,
}) => {
  await page.goto('/')

  const tree = page.getByTestId('task-tree')
  const before = await tree.boundingBox()
  if (!before) throw new Error('tree panel not found')

  const handle = page.getByTitle('Drag to resize').first()
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('resize handle not found')

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 150, handleBox.y + handleBox.height / 2, { steps: 10 })
  await page.mouse.up()

  const after = await tree.boundingBox()
  if (!after) throw new Error('tree panel not found after resize')
  expect(after.width).toBeGreaterThan(before.width + 100)

  // Persisted across reload.
  await page.reload()
  const afterReload = await tree.boundingBox()
  if (!afterReload) throw new Error('tree panel not found after reload')
  expect(afterReload.width).toBeCloseTo(after.width, 0)
})
