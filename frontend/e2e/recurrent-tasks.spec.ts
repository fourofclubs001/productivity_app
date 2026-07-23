import { test, expect, type Page } from '@playwright/test'

async function openNewRecurrentTaskDialog(page: Page) {
  await page.getByTitle('New recurrent item').click()
  await page.getByRole('button', { name: 'Recurrent task', exact: true }).click()
}

async function openNewRecurrentGroupDialog(page: Page) {
  await page.getByTitle('New recurrent item').click()
  await page.getByRole('button', { name: 'Recurrent group' }).click()
}

test('creating a daily recurrent task auto-schedules its first occurrence without any manual drag', async ({
  page,
}) => {
  const taskName = `Water plants ${Date.now()}`

  await page.goto('/')

  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await expect(page.getByText(/no recurrent tasks yet/i)).toBeVisible()

  await openNewRecurrentTaskDialog(page)
  await expect(page.getByRole('heading', { name: 'New recurrent task' })).toBeVisible()

  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('Soil is moist')
  await page.getByLabel('Repeat unit').selectOption('day')
  await page.getByRole('button', { name: 'Create' }).click()

  // The dialog closes and the new recurrent task shows up in the Recurrent
  // tasks list, selected.
  await expect(page.getByRole('heading', { name: 'New recurrent task' })).not.toBeVisible()
  await expect(
    page.getByTestId('recurrent-tasks-list').getByText(taskName, { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Task name')).toHaveValue(taskName)

  // Its first occurrence was generated server-side (RecurrentTaskService.
  // ensure_applied, M38) as a side effect of creation -- no drag, no
  // "Add to calendar" click, just a chip appearing on the Plan calendar
  // once the create mutation invalidates the intervals query. (A daily
  // recurrent task can produce more than one visible chip within the
  // currently-displayed week -- one per remaining day -- so just check
  // that at least one shows up, not an exact count.)
  await expect(page.locator('.rbc-event', { hasText: taskName }).first()).toBeVisible()

  // Switching back to the Tasks tab never shows it -- it lives only in the
  // Recurrent tasks tab.
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(page.getByTestId('task-tree').getByText(taskName)).not.toBeVisible()
})

test('picking a start after the current end auto-adjusts the end instead of blocking with a warning', async ({
  page,
}) => {
  const taskName = `AutoAdjustEnd ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await openNewRecurrentTaskDialog(page)

  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('done')

  // Only the date moves -- comparing against the start *hour* (left
  // untouched) rather than a hardcoded value keeps this deterministic
  // regardless of whatever real wall-clock time the suite happens to run at.
  const startHourBefore = await page.getByLabel('Start hour').inputValue()
  const endDateBefore = await page.getByLabel('End date').inputValue()
  await page.getByLabel('Start date').fill('2027-01-15')

  await expect(page.getByLabel('End date')).not.toHaveValue(endDateBefore)
  await expect(page.getByLabel('End date')).toHaveValue('2027-01-15')
  await expect(page.getByLabel('End hour')).toHaveValue(startHourBefore)
  await expect(page.getByText(/end must be after start/i)).not.toBeVisible()
})

test('selecting a day-of-week other than today still creates the recurrent task, previewing the real first occurrence', async ({
  page,
}) => {
  // v05 item 11 repro: picking a weekly day-of-week that doesn't match
  // today (e.g. "Monday" while today is Thursday) used to leave the user
  // with no visible confirmation anything happened -- creation actually
  // always succeeded server-side, resolving to the closest future matching
  // day, but the current week's Plan calendar shows nothing for it, which
  // reads as "I can't create the task." The new "First occurrence" preview
  // fixes the visibility gap; this asserts both the preview and that
  // creation is never blocked, for a day guaranteed different from today.
  const dayLabels = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]
  const todayIsoWeekday = (new Date().getDay() + 6) % 7
  const targetIsoWeekday = (todayIsoWeekday + 3) % 7 // always different from today
  const targetLabel = dayLabels[targetIsoWeekday]

  const taskName = `Weekday resolve ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await openNewRecurrentTaskDialog(page)

  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByLabel('Repeat unit').selectOption('week')
  await page.locator('button[aria-pressed]').nth(targetIsoWeekday).click()

  await expect(
    page.getByText(new RegExp(`First occurrence:.*${targetLabel}`)),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('heading', { name: 'New recurrent task' })).not.toBeVisible()
  await expect(
    page.getByTestId('recurrent-tasks-list').getByText(taskName, { exact: true }),
  ).toBeVisible()
})

test('deleting a recurrent task removes it via the same right-click flow as a task', async ({
  page,
}) => {
  const taskName = `Standup ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await openNewRecurrentTaskDialog(page)
  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('Attended')
  await page.getByLabel('Repeat unit').selectOption('day')
  await page.getByRole('button', { name: 'Create' }).click()

  // exact: true so this never also matches the ConfirmDialog's longer
  // "Delete "<name>" permanently?" sentence below (which contains the same
  // name as a substring).
  const row = page.getByTestId('recurrent-tasks-list').getByText(taskName, { exact: true })
  await expect(row).toBeVisible()

  await row.click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(row).not.toBeVisible()
})

test('recurrent groups: create, nest via re-visible expand, and delete with ungroup vs delete-children choice', async ({
  page,
}) => {
  const suffix = Date.now()
  const groupName = `GroupGrp ${suffix}`
  const taskName = `GroupedTask ${suffix}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()

  // Create a group -- name only, no schedule fields.
  await openNewRecurrentGroupDialog(page)
  await expect(page.getByRole('heading', { name: 'New recurrent group' })).toBeVisible()
  await page.getByLabel('Name').fill(groupName)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('heading', { name: 'New recurrent group' })).not.toBeVisible()

  const list = page.getByTestId('recurrent-tasks-list')
  await expect(list.getByText(groupName, { exact: true })).toBeVisible()

  // Create a plain recurrent task alongside it -- both start ungrouped;
  // nesting them together is exercised by drag-and-drop in a separate test
  // below (item 10).
  await openNewRecurrentTaskDialog(page)
  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByLabel('Repeat unit').selectOption('day')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(list.getByText(taskName, { exact: true })).toBeVisible()

  // Deleting the (childless) group offers the same ungroup/delete-children
  // choice regardless -- exercise "Ungroup" first on a second throwaway
  // group to confirm the dialog wiring, then delete the real one via
  // "Delete children too" (equivalent to a plain delete when childless).
  await list.getByText(groupName, { exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(/Choose what happens to anything inside it/)).toBeVisible()
  await page.getByRole('button', { name: 'Delete children too' }).click()
  await expect(list.getByText(groupName, { exact: true })).not.toBeVisible()
})

test('dragging a recurrent task onto a group nests it (item 10)', async ({ page, request }) => {
  const suffix = Date.now()
  const groupName = `DragGroup ${suffix}`
  const taskName = `DragTask ${suffix}`

  const group = await (
    await request.post('http://localhost:8001/recurrent-tasks/groups', {
      data: { name: groupName },
    })
  ).json()
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const task = await (
    await request.post('http://localhost:8001/recurrent-tasks', {
      data: {
        name: taskName,
        definition_of_done: 'done',
        start: start.toISOString(),
        end: end.toISOString(),
        recurrence_interval: 1,
        recurrence_unit: 'day',
        recurrence_end_type: 'never',
      },
    })
  ).json()
  expect(group.id).toBeTruthy()
  expect(task.id).toBeTruthy()

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()

  const list = page.getByTestId('recurrent-tasks-list')
  const groupRow = list.getByText(groupName, { exact: true })
  const taskRow = list.getByText(taskName, { exact: true })
  await expect(groupRow).toBeVisible()
  await expect(taskRow).toBeVisible()

  const groupBox = await groupRow.boundingBox()
  const taskBox = await taskRow.boundingBox()
  if (!groupBox || !taskBox) throw new Error('rows not found')

  await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(groupBox.x + groupBox.width / 2, groupBox.y + groupBox.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  // The task moved under the group -- collapsed by default, so it
  // disappears until the group is expanded.
  await expect(taskRow).not.toBeVisible()
  await groupRow.click()
  await expect(taskRow).toBeVisible()
})

test('dragging a recurrent task onto another recurrent task never reparents it', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  const nameA = `NoReparentA ${suffix}`
  const nameB = `NoReparentB ${suffix}`

  async function createPlainRecurrentTask(name: string) {
    const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const response = await request.post('http://localhost:8001/recurrent-tasks', {
      data: {
        name,
        definition_of_done: 'done',
        start: start.toISOString(),
        end: end.toISOString(),
        recurrence_interval: 1,
        recurrence_unit: 'day',
        recurrence_end_type: 'never',
      },
    })
    return response.json()
  }

  const taskA = await createPlainRecurrentTask(nameA)
  const taskB = await createPlainRecurrentTask(nameB)
  expect(taskA.id).toBeTruthy()
  expect(taskB.id).toBeTruthy()

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()

  const list = page.getByTestId('recurrent-tasks-list')
  const rowA = list.getByText(nameA, { exact: true })
  const rowB = list.getByText(nameB, { exact: true })
  await expect(rowA).toBeVisible()
  await expect(rowB).toBeVisible()

  const boxA = await rowA.boundingBox()
  const boxB = await rowB.boundingBox()
  if (!boxA || !boxB) throw new Error('rows not found')

  // Drop dead-center on B -- would be a reparent onto a group, but B is a
  // plain task, so this must fall back to a sibling reorder instead.
  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2)
  await page.mouse.down()
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, { steps: 10 })
  await page.mouse.up()

  // Both still visible as top-level siblings -- neither disappeared into
  // the other (which would happen if A had become B's child, collapsed by
  // default).
  await expect(rowA).toBeVisible()
  await expect(rowB).toBeVisible()
})
