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
  // The last day column of the currently-displayed week (Sunday) -- always
  // safely in the future relative to "now" no matter what day the test
  // suite runs, avoiding the backend's "no past-dated intervals" guard (v02
  // item 8). The y-offset (300px from the day column's top) stays within
  // the actual viewport -- the column itself spans the full 24h and is far
  // taller than the visible page, so a point near its bottom would be
  // off-screen and never receive the drop.
  const daySlot = page.locator('.rbc-day-slot').last()
  const slotBox = await daySlot.boundingBox()
  if (!rowBox || !slotBox) throw new Error('row or day-slot bounding box not found')

  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + 300, { steps: 10 })
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

test('a drop-preview ghost chip appears while dragging, before the drop', async ({
  page,
  request,
}) => {
  const task = await createTask(request, `Ghost ${Date.now()}`)

  await page.goto('/')

  const row = page.getByTestId('task-tree').locator('.group', { hasText: task.name })
  await row.scrollIntoViewIfNeeded()
  const rowBox = await row.boundingBox()
  const daySlot = page.locator('.rbc-day-slot').last()
  const slotBox = await daySlot.boundingBox()
  if (!rowBox || !slotBox) throw new Error('row or day-slot bounding box not found')

  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
  await page.mouse.down()
  await expect(page.getByTestId('drag-preview-chip')).not.toBeVisible()

  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + 300, { steps: 10 })
  const ghost = page.getByTestId('drag-preview-chip')
  await expect(ghost).toBeVisible()
  await expect(ghost).toContainText(task.name)

  await page.mouse.up()
  await expect(ghost).not.toBeVisible()
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

  // Computed inside the browser so these are always safely in the future
  // relative to whatever "now" the page itself sees, avoiding the "no
  // past-dated intervals" guard (v02 item 8) regardless of host/browser
  // timezone or time of day. Both date and time-of-day are filled
  // explicitly (rather than relying on the modal's own same-day default)
  // so this stays deterministic even right around a real local midnight.
  const times = await page.evaluate(() => {
    function dateAndHhmm(d: Date) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      }
    }
    const requiredStart = new Date()
    requiredStart.setMinutes(0, 0, 0)
    requiredStart.setHours(requiredStart.getHours() + 1)
    const requiredEnd = new Date(requiredStart.getTime() + 60 * 60 * 1000)
    const taskEnd = new Date(requiredEnd.getTime() + 60 * 60 * 1000)
    return {
      requiredStart: dateAndHhmm(requiredStart),
      requiredEnd: dateAndHhmm(requiredEnd),
      taskEnd: dateAndHhmm(taskEnd),
    }
  })

  // Schedule the prerequisite first.
  await page.getByTestId('task-tree').getByText(required.name).click()
  await expect(page.getByLabel('Task name')).toHaveValue(required.name)
  await page.getByTitle('Add to calendar').click()
  await page.getByLabel('Start date').fill(times.requiredStart.date)
  await page.getByLabel('Start hour').fill(times.requiredStart.time)
  await page.getByLabel('End date').fill(times.requiredEnd.date)
  await page.getByLabel('End hour').fill(times.requiredEnd.time)
  await page.locator('form').getByRole('button', { name: 'Add' }).click()
  await expect(page.locator('.rbc-event', { hasText: required.name })).toBeVisible()

  // The dependent task can now be scheduled starting right when it ends.
  await page.getByTestId('task-tree').getByText(task.name).click()
  await expect(page.getByLabel('Task name')).toHaveValue(task.name)
  await page.getByTitle('Add to calendar').click()
  await page.getByLabel('Start date').fill(times.requiredEnd.date)
  await page.getByLabel('Start hour').fill(times.requiredEnd.time)
  await page.getByLabel('End date').fill(times.taskEnd.date)
  await page.getByLabel('End hour').fill(times.taskEnd.time)
  await page.locator('form').getByRole('button', { name: 'Add' }).click()
  await expect(page.locator('.rbc-event', { hasText: task.name })).toBeVisible()
})
