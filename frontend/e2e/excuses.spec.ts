import { test, expect, type APIRequestContext } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done' },
  })
  return response.json()
}

function localDateTimeParts(date: Date): { day: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

// A start/end pair a few real hours from "now" (local time) -- safely
// future, and deliberately offset from other specs' "next hour"/"today at 9
// UTC" scheduling defaults so this spec's chip doesn't land exactly on top
// of another spec's leftover event (this suite doesn't flush Redis between
// specs -- see PROJECT_STATUS.md's crowding note). Kept same-day (start is
// nudged into the small hours of the next day rather than left near
// midnight) purely to keep this helper simple, not because the form
// requires it.
function futureSlotSameDay(): { start: Date; end: Date } {
  let start = new Date(Date.now() + 2 * 60 * 60 * 1000)
  if (start.getHours() >= 23) {
    start = new Date(start)
    start.setHours(0, 30, 0, 0)
    start.setDate(start.getDate() + 1)
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return { start, end }
}

test('explaining a fully-uncovered gap attaches a new excuse, reflected in the Excuses subtab', async ({
  page,
  request,
}) => {
  const task = await createTask(request, `Excuse ${Date.now()}`)

  await page.goto('/')

  // Schedule the task (via the "Add to calendar" modal) and never track any
  // real time against it, so the whole planned interval is one uncovered
  // gap in diff mode.
  await page.getByTestId('task-tree').getByText(task.name).click()
  await expect(page.getByLabel('Task name')).toHaveValue(task.name)
  await page.getByTitle('Add to calendar').click()
  await expect(page.getByRole('heading', { name: 'Add to calendar' })).toBeVisible()
  const { start, end } = futureSlotSameDay()
  const { day, time: startTime } = localDateTimeParts(start)
  const { time: endTime } = localDateTimeParts(end)
  await page.getByLabel('Start date').fill(day)
  await page.getByLabel('Start hour').fill(startTime)
  await page.getByLabel('End date').fill(day)
  await page.getByLabel('End hour').fill(endTime)
  await page.locator('form').getByRole('button', { name: 'Add' }).click()

  await page.getByRole('button', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await page.getByRole('button', { name: 'Diff' }).click()

  const gapChip = page.locator('.rbc-event', { hasText: task.name })
  await expect(gapChip).toBeVisible()
  await gapChip.click()

  await expect(page.getByRole('heading', { name: 'Explain this gap' })).toBeVisible()
  await page.getByLabel('Or type a new one').fill('Got distracted')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Explain this gap' })).not.toBeVisible()

  await page.getByRole('button', { name: 'Excuses', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Got distracted' }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: task.name })).toBeVisible()
})
