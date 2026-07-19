import { test, expect, type APIRequestContext } from '@playwright/test'
import { todayAt } from './helpers/time'

const API_BASE = 'http://localhost:8001'

async function createTaskWithInterval(
  request: APIRequestContext,
  name: string,
  startISO: string,
  endISO: string,
) {
  const task = await (
    await request.post(`${API_BASE}/tasks`, { data: { name, definition_of_done: 'done' } })
  ).json()
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: task.id, start: startISO, end: endISO },
  })
  return task
}

async function getIntervalForTask(request: APIRequestContext, taskId: string) {
  const list = await (await request.get(`${API_BASE}/intervals/by-task/${taskId}`)).json()
  return list[0]
}

test('dragging an existing event moves it to a new time', async ({ page, request }) => {
  const start = todayAt(9)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const task = await createTaskWithInterval(
    request,
    `Move ${Date.now()}`,
    start.toISOString(),
    end.toISOString(),
  )

  await page.goto('/')
  const eventEl = page.locator('.rbc-event', { hasText: task.name })
  await expect(eventEl).toBeVisible()
  const box = await eventEl.boundingBox()
  if (!box) throw new Error('event box not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, { steps: 10 })
  await page.mouse.up()

  await expect
    .poll(async () => (await getIntervalForTask(request, task.id)).start)
    .not.toBe(start.toISOString())
})

test('the source chip is hidden while dragging it to reschedule, and reappears on drop', async ({
  page,
  request,
}) => {
  const start = todayAt(14)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const task = await createTaskWithInterval(
    request,
    `HideDuringDrag ${Date.now()}`,
    start.toISOString(),
    end.toISOString(),
  )

  await page.goto('/')
  const eventEl = page.locator('.rbc-event', { hasText: task.name })
  await expect(eventEl).toBeVisible()
  const box = await eventEl.boundingBox()
  if (!box) throw new Error('event box not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 5 })

  await expect(page.locator('.rbc-addons-dnd-dragged-event', { hasText: task.name })).toHaveCSS(
    'opacity',
    '0',
  )

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, { steps: 10 })
  await page.mouse.up()

  await expect
    .poll(async () => (await getIntervalForTask(request, task.id)).start)
    .not.toBe(start.toISOString())
  await expect(page.locator('.rbc-event', { hasText: task.name })).toHaveCSS('opacity', '1')
})

test('cancelling a reschedule drag with Escape restores the source chip at its original slot', async ({
  page,
  request,
}) => {
  const start = todayAt(11)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const task = await createTaskWithInterval(
    request,
    `AbortReschedule ${Date.now()}`,
    start.toISOString(),
    end.toISOString(),
  )

  await page.goto('/')
  const eventEl = page.locator('.rbc-event', { hasText: task.name })
  await expect(eventEl).toBeVisible()
  const box = await eventEl.boundingBox()
  if (!box) throw new Error('event box not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 5 })

  await expect(page.locator('.rbc-addons-dnd-dragged-event', { hasText: task.name })).toHaveCSS(
    'opacity',
    '0',
  )

  await page.keyboard.press('Escape')
  await page.mouse.up()

  await expect(page.locator('.rbc-event', { hasText: task.name })).toHaveCSS('opacity', '1')
  const interval = await getIntervalForTask(request, task.id)
  expect(new Date(interval.start).getTime()).toBe(start.getTime())
})

test("dragging an event's bottom edge resizes its duration", async ({ page, request }) => {
  const start = todayAt(9)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const task = await createTaskWithInterval(
    request,
    `Resize ${Date.now()}`,
    start.toISOString(),
    end.toISOString(),
  )

  await page.goto('/')
  const eventEl = page.locator('.rbc-event', { hasText: task.name })
  await expect(eventEl).toBeVisible()
  const box = await eventEl.boundingBox()
  if (!box) throw new Error('event box not found')

  // The resize handle is a thin strip right at the bottom edge of the event.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 100, { steps: 10 })
  await page.mouse.up()

  await expect
    .poll(async () => (await getIntervalForTask(request, task.id)).end)
    .not.toBe(end.toISOString())
})

test('clicking a scheduled event opens the task detail view', async ({ page, request }) => {
  const start = todayAt(9)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const task = await createTaskWithInterval(
    request,
    `OpenDetail ${Date.now()}`,
    start.toISOString(),
    end.toISOString(),
  )

  await page.goto('/')
  await page.locator('.rbc-event', { hasText: task.name }).click()

  await expect(page.getByLabel('Task name')).toHaveValue(task.name)
})
