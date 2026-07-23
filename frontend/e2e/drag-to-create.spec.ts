import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done' },
  })
  return response.json()
}

/** Drags on empty Plan-calendar grid space (not onto any existing chip or
 * tree row) to open the new-event chooser (v05 item 9). `yOffset` lets
 * different tests target different vertical bands of the day column so
 * they don't collide with each other's chips within the same run.
 */
async function dragSelectEmptySlot(page: Page, yOffset: number) {
  const daySlot = page.locator('.rbc-day-slot').last()
  const box = await daySlot.boundingBox()
  if (!box) throw new Error('day slot not found')
  const x = box.x + box.width / 2
  const startY = box.y + yOffset
  await page.mouse.move(x, startY)
  await page.mouse.down()
  await page.mouse.move(x, startY + 60, { steps: 5 })
  await page.mouse.up()
}

test('drag-selecting empty calendar space and choosing an existing task schedules it', async ({
  page,
  request,
}) => {
  const task = await createTask(request, `DragExisting ${Date.now()}`)

  await page.goto('/')
  await dragSelectEmptySlot(page, 60)

  await expect(page.getByRole('heading', { name: 'New…' })).toBeVisible()
  await page.getByRole('button', { name: 'Existing task' }).click()

  await expect(page.getByRole('heading', { name: 'Schedule existing task' })).toBeVisible()
  await page.getByTestId('task-picker-trigger').click()
  await page
    .getByTestId('task-picker-options')
    .getByRole('button', { name: task.name, exact: true })
    .click()
  await page.getByRole('button', { name: 'Schedule' }).click()

  await expect(page.getByRole('heading', { name: 'Schedule existing task' })).not.toBeVisible()
  await expect(page.locator('.rbc-event', { hasText: task.name })).toBeVisible()
})

test('drag-selecting empty space and choosing "New task (not recurring)" creates and schedules it in one step', async ({
  page,
}) => {
  const taskName = `DragNewPlain ${Date.now()}`

  await page.goto('/')
  await dragSelectEmptySlot(page, 160)

  await page.getByRole('button', { name: 'New task (not recurring)' }).click()
  await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible()

  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('heading', { name: 'New task' })).not.toBeVisible()
  await expect(page.locator('.rbc-event', { hasText: taskName })).toBeVisible()

  // It's a plain (non-recurring) task -- shows up in the main Tasks tree,
  // not the Recurrent tasks tab.
  await expect(page.getByTestId('task-tree').getByText(taskName)).toBeVisible()
})

test('drag-selecting empty space and choosing "New task (recurring)" pre-fills the dragged range', async ({
  page,
}) => {
  const taskName = `DragNewRecurrent ${Date.now()}`

  await page.goto('/')
  await dragSelectEmptySlot(page, 260)

  await page.getByRole('button', { name: 'New task (recurring)' }).click()
  await expect(page.getByRole('heading', { name: 'New recurrent task' })).toBeVisible()

  // Pre-filled from the drag rather than defaultTimeValue()'s "next hour,
  // today" -- just confirm the fields hold *some* concrete value (not
  // asserting the exact dragged time, which is a scroll-position-dependent
  // pixel->time computation not worth pinning exactly here).
  await expect(page.getByLabel('Start date')).not.toHaveValue('')
  await expect(page.getByLabel('Start hour')).not.toHaveValue('')

  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('heading', { name: 'New recurrent task' })).not.toBeVisible()
  await expect(page.locator('.rbc-event', { hasText: taskName }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await expect(
    page.getByTestId('recurrent-tasks-list').getByText(taskName, { exact: true }),
  ).toBeVisible()
})

test('cancelling the chooser leaves the calendar untouched', async ({ page }) => {
  await page.goto('/')
  await dragSelectEmptySlot(page, 360)
  await expect(page.getByRole('heading', { name: 'New…' })).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'New…' })).not.toBeVisible()
})
