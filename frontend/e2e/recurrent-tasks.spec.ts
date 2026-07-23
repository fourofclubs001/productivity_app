import { test, expect } from '@playwright/test'

test('creating a daily recurrent task auto-schedules its first occurrence without any manual drag', async ({
  page,
}) => {
  const taskName = `Water plants ${Date.now()}`

  await page.goto('/')

  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await expect(page.getByText(/no recurrent tasks yet/i)).toBeVisible()

  await page.getByTitle('New recurrent task').click()
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
  await page.getByTitle('New recurrent task').click()

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
  await page.getByTitle('New recurrent task').click()

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
  await page.getByTitle('New recurrent task').click()
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
