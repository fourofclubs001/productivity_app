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
  const daySlot = page.locator('.rbc-day-slot').first()
  const slotBox = await daySlot.boundingBox()
  if (!rowBox || !slotBox) throw new Error('row or day-slot bounding box not found')

  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + 150, { steps: 10 })
  await page.mouse.up()
}

test('dragging a leaf task from the panel onto the calendar schedules it', async ({
  page,
  request,
}) => {
  const task = await createTask(request, `Schedule ${Date.now()}`)

  await page.goto('/')
  await dragTaskOntoCalendar(page, task.name)

  await expect(page.locator('.rbc-event', { hasText: task.name })).toBeVisible()
})

test('scheduling a task via the "Add to calendar" modal creates an event', async ({
  page,
  request,
}) => {
  const task = await createTask(request, `ModalSchedule ${Date.now()}`)

  await page.goto('/')
  await page.getByTestId('task-tree').getByText(task.name).click()
  await expect(page.getByLabel('Task name')).toHaveValue(task.name)

  await page.getByTitle('Add to calendar').click()
  await expect(page.getByRole('heading', { name: 'Add to calendar' })).toBeVisible()
  await page.locator('form').getByRole('button', { name: 'Add' }).click()

  await expect(page.locator('.rbc-event', { hasText: task.name })).toBeVisible()
})

test('dragging a task with an unmet prerequisite onto the calendar is rejected with a dialog', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  const required = await createTask(request, `Blocker ${suffix}`)
  const task = await createTask(request, `Blocked ${suffix}`)
  await request.post(`${API_BASE}/tasks/${task.id}/requires`, {
    data: { required_id: required.id },
  })

  await page.goto('/')
  await dragTaskOntoCalendar(page, task.name)

  await expect(page.getByText(/cannot be scheduled until its prerequisites/i)).toBeVisible()
  const okButton = page.getByRole('button', { name: 'OK' })
  await expect(okButton).toBeVisible()
  await okButton.click()
  await expect(page.getByText(/cannot be scheduled until its prerequisites/i)).not.toBeVisible()
  await expect(page.locator('.rbc-event', { hasText: task.name })).not.toBeVisible()
})

test('a task can be scheduled via the modal once its prerequisite is scheduled before it', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  const required = await createTask(request, `Blocker2 ${suffix}`)
  const task = await createTask(request, `Blocked2 ${suffix}`)
  await request.post(`${API_BASE}/tasks/${task.id}/requires`, {
    data: { required_id: required.id },
  })

  await page.goto('/')

  // Schedule the prerequisite first: 01:00-02:00 (today, the modal's
  // default day) -- an arbitrary early hour unlikely to collide with the
  // modal's own "now, rounded up" default time.
  await page.getByTestId('task-tree').getByText(required.name).click()
  await expect(page.getByLabel('Task name')).toHaveValue(required.name)
  await page.getByTitle('Add to calendar').click()
  await page.getByLabel('Start hour').fill('01:00')
  await page.getByLabel('End hour').fill('02:00')
  await page.locator('form').getByRole('button', { name: 'Add' }).click()
  await expect(page.locator('.rbc-event', { hasText: required.name })).toBeVisible()

  // The dependent task can now be scheduled starting right when it ends.
  await page.getByTestId('task-tree').getByText(task.name).click()
  await expect(page.getByLabel('Task name')).toHaveValue(task.name)
  await page.getByTitle('Add to calendar').click()
  await page.getByLabel('Start hour').fill('02:00')
  await page.getByLabel('End hour').fill('03:00')
  await page.locator('form').getByRole('button', { name: 'Add' }).click()
  await expect(page.locator('.rbc-event', { hasText: task.name })).toBeVisible()
})
