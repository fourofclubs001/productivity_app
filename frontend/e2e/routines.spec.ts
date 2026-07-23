import { test, expect } from '@playwright/test'

test('creating a daily routine auto-schedules its first occurrence without any manual drag', async ({
  page,
}) => {
  const routineName = `Water plants ${Date.now()}`

  await page.goto('/')

  await page.getByRole('button', { name: 'Routines' }).click()
  await expect(page.getByText(/no routines yet/i)).toBeVisible()

  await page.getByTitle('New routine').click()
  await expect(page.getByRole('heading', { name: 'New routine' })).toBeVisible()

  await page.getByLabel('Name').fill(routineName)
  await page.getByLabel('Definition of done').fill('Soil is moist')
  await page.getByLabel('Repeat unit').selectOption('day')
  await page.getByRole('button', { name: 'Create' }).click()

  // The dialog closes and the new routine shows up in the Routines list,
  // selected.
  await expect(page.getByRole('heading', { name: 'New routine' })).not.toBeVisible()
  await expect(
    page.getByTestId('routines-list').getByText(routineName, { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Task name')).toHaveValue(routineName)

  // Its first occurrence was generated server-side (RoutineService.
  // ensure_applied, M38) as a side effect of creation -- no drag, no
  // "Add to calendar" click, just a chip appearing on the Plan calendar
  // once the create-routine mutation invalidates the intervals query.
  // (A daily routine can produce more than one visible chip within the
  // currently-displayed week -- one per remaining day -- so just check
  // that at least one shows up, not an exact count.)
  await expect(page.locator('.rbc-event', { hasText: routineName }).first()).toBeVisible()

  // Switching back to the Tasks tab never shows the routine -- it lives
  // only in the Routines tab.
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(page.getByTestId('task-tree').getByText(routineName)).not.toBeVisible()
})

test('selecting a day-of-week other than today still creates the routine, previewing the real first occurrence', async ({
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

  const routineName = `Weekday resolve ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Routines' }).click()
  await page.getByTitle('New routine').click()

  await page.getByLabel('Name').fill(routineName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByLabel('Repeat unit').selectOption('week')
  await page.locator('button[aria-pressed]').nth(targetIsoWeekday).click()

  await expect(
    page.getByText(new RegExp(`First occurrence:.*${targetLabel}`)),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('heading', { name: 'New routine' })).not.toBeVisible()
  await expect(
    page.getByTestId('routines-list').getByText(routineName, { exact: true }),
  ).toBeVisible()
})

test('deleting a routine removes it via the same right-click flow as a task', async ({ page }) => {
  const routineName = `Standup ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Routines' }).click()
  await page.getByTitle('New routine').click()
  await page.getByLabel('Name').fill(routineName)
  await page.getByLabel('Definition of done').fill('Attended')
  await page.getByLabel('Repeat unit').selectOption('day')
  await page.getByRole('button', { name: 'Create' }).click()

  // exact: true so this never also matches the ConfirmDialog's longer
  // "Delete "<name>" permanently?" sentence below (which contains the same
  // name as a substring).
  const row = page.getByTestId('routines-list').getByText(routineName, { exact: true })
  await expect(row).toBeVisible()

  await row.click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(row).not.toBeVisible()
})
