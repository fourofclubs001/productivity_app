import { test, expect } from '@playwright/test'
import { todayAt } from './helpers/time'

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

  const start = todayAt(10)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
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

  // Ctrl+Y redoes the delete.
  await page.keyboard.press('Control+y')
  await expect(page.locator('.rbc-event', { hasText: taskName })).not.toBeVisible()
})

test('ctrl+z undoes a drag-created interval, and ctrl+y redoes it', async ({ page, request }) => {
  const task = await (
    await request.post(`${API_BASE}/tasks`, {
      data: { name: `DragUndo ${Date.now()}`, definition_of_done: 'done' },
    })
  ).json()

  // Tall enough that this test's task row is always within the viewport
  // without needing to scroll the tree panel, no matter how many tasks
  // earlier specs in the same run have accumulated (Redis is only flushed
  // once per whole run) -- dragging a row that needs scrolling into view
  // first throws off dnd-kit's reported pointer delta (a pre-existing,
  // unrelated drag-and-drop geometry quirk with long scrollable lists, not
  // something this milestone's undo/redo work should try to fix).
  await page.setViewportSize({ width: 1280, height: 3000 })
  await page.goto('/')

  const row = page.getByTestId('task-tree').locator('.group', { hasText: task.name })
  await row.scrollIntoViewIfNeeded()
  const rowBox = await row.boundingBox()
  // The last day column of the currently-displayed week (Sunday) -- always
  // safely in the future relative to "now" no matter what day the test
  // suite runs (see schedule.spec.ts's dragTaskOntoCalendar). A distinct
  // y-offset (150px, vs. other specs' 300px) avoids landing on the exact
  // same slot as their events, reducing crowding under a long,
  // suite-accumulated task/event list.
  const daySlot = page.locator('.rbc-day-slot').last()
  const slotBox = await daySlot.boundingBox()
  if (!rowBox || !slotBox) throw new Error('row or day-slot bounding box not found')

  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + 150, { steps: 10 })
  await page.mouse.up()

  const event = page.locator('.rbc-event', { hasText: task.name })
  await expect(event).toBeVisible()

  await page.keyboard.press('Control+z')
  await expect(event).not.toBeVisible()

  await page.keyboard.press('Control+y')
  await expect(event).toBeVisible()
})

test('ctrl+z is scoped per view: switching views changes what gets undone', async ({
  page,
  request,
}) => {
  const planTaskName = `PerViewPlan ${Date.now()}`
  const executeTaskName = `PerViewExecute ${Date.now()}`

  // A Plan-only undoable action: schedule then right-click-delete a task's
  // interval, pushing an undo entry tagged only "plan".
  const planTask = await (
    await request.post(`${API_BASE}/tasks`, {
      data: { name: planTaskName, definition_of_done: 'done' },
    })
  ).json()
  const start = todayAt(13)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: planTask.id, start: start.toISOString(), end: end.toISOString() },
  })

  await page.goto('/')
  const planEvent = page.locator('.rbc-event', { hasText: planTaskName })
  await expect(planEvent).toBeVisible()
  await planEvent.click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(planEvent).not.toBeVisible()

  // An Execute action (mark sprint done), pushed while a different task is
  // created and tracked -- this touches state that's cross-view (both
  // Plan's StateBadge and Execute's own timer picker depend on it), so it's
  // undoable from Execute.
  await request.post(`${API_BASE}/tasks`, {
    data: { name: executeTaskName, definition_of_done: 'done' },
  })
  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByTestId('task-picker-trigger').click()
  await page
    .getByTestId('task-picker-options')
    .getByRole('button', { name: executeTaskName, exact: true })
    .click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  // Wait for the mark-done mutation (and its pushUndo) to actually settle
  // before pressing ctrl+z, rather than racing it.
  await expect(page.getByText(/stopped/i)).not.toBeVisible()

  // Ctrl+Z on Execute undoes the mark-done, not the (older, Plan-tagged)
  // interval deletion.
  await page.keyboard.press('Control+z')
  await page.getByTestId('task-picker-trigger').click()
  await expect(
    page.getByTestId('task-picker-options').getByRole('button', { name: executeTaskName, exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.rbc-event', { hasText: planTaskName })).not.toBeVisible()

  // Switching to Plan and pressing Ctrl+Z now reaches the older, Plan-tagged
  // entry -- restoring the deleted interval, unaffected by the Execute undo
  // that happened in between.
  await page.getByRole('button', { name: 'Plan' }).click()
  await page.keyboard.press('Control+z')
  await expect(page.locator('.rbc-event', { hasText: planTaskName })).toBeVisible()
})

test('ctrl+z undoes an interval created via the "Add to calendar" modal', async ({
  page,
  request,
}) => {
  const task = await (
    await request.post(`${API_BASE}/tasks`, {
      data: { name: `ModalUndo ${Date.now()}`, definition_of_done: 'done' },
    })
  ).json()

  await page.goto('/')
  await page.getByTestId('task-tree').getByText(task.name).click()
  await expect(page.getByLabel('Task name')).toHaveValue(task.name)

  await page.getByTitle('Add to calendar').click()
  await page.locator('form').getByRole('button', { name: 'Add' }).click()

  const event = page.locator('.rbc-event', { hasText: task.name })
  await expect(event).toBeVisible()

  await page.keyboard.press('Control+z')
  await expect(event).not.toBeVisible()

  await page.keyboard.press('Control+y')
  await expect(event).toBeVisible()
})
