import { test, expect, type Page } from '@playwright/test'

function pickerTrigger(page: Page) {
  return page.getByTestId('task-picker-trigger')
}

function pickerOptions(page: Page) {
  return page.getByTestId('task-picker-options')
}

async function selectExecuteTask(page: Page, taskName: string) {
  await pickerTrigger(page).click()
  await pickerOptions(page).getByRole('button', { name: taskName, exact: true }).click()
}

test('Stop opens a confirm dialog before stopping anything, then Yes marks done', async ({
  page,
}) => {
  const taskName = `Timer flow ${Date.now()}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('task-tree').getByText(taskName)).toBeVisible()

  await page.getByRole('button', { name: 'Execute' }).click()
  await selectExecuteTask(page, taskName)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Tracking')).toBeVisible()

  await page.getByRole('button', { name: 'Stop' }).click()
  // Clicking Stop only opens the confirm dialog -- the timer is still
  // "Tracking" until an explicit choice is made.
  await expect(page.getByText('Is the definition of done fulfilled?')).toBeVisible()
  await expect(page.getByText('Tracking')).toBeVisible()

  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()

  // Once sprint_done, the task is no longer offered in the timer picker.
  await pickerTrigger(page).click()
  await expect(pickerOptions(page).getByRole('button', { name: taskName, exact: true })).not.toBeVisible()
})

test('Cancel leaves the timer running untouched', async ({ page }) => {
  // Deliberately avoid the substring "Cancel" in the fixture name -- it
  // would collide with the modal's own "Cancel" button in accessible-name
  // matching once the active entry's calendar chip renders the task name
  // (see PROJECT_STATUS.md's documented fixture-naming gotcha).
  const taskName = `Timer abort ${Date.now()}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await selectExecuteTask(page, taskName)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Dialog gone, timer still tracking the same task, no stop/mark-done call happened.
  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()
  await expect(page.getByText('Tracking')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  // The active timer is a single global key (not per-test isolated) -- stop
  // it for real before the test ends so it doesn't leak into later tests.
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'No, stop the timer' }).click()
})

test('ctrl+z after marking done reverts the task back to in_progress', async ({ page }) => {
  const taskName = `Timer undo ${Date.now()}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await selectExecuteTask(page, taskName)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()

  await pickerTrigger(page).click()
  await expect(pickerOptions(page).getByRole('button', { name: taskName, exact: true })).not.toBeVisible()
  await page.keyboard.press('Escape')

  await page.keyboard.press('Control+z')

  // Reverted to in_progress, so it's selectable in the timer picker again.
  await pickerTrigger(page).click()
  await expect(pickerOptions(page).getByRole('button', { name: taskName, exact: true })).toBeVisible()
})

test('starting a timer on a task with an unmet prerequisite is rejected with a dialog', async ({
  page,
}) => {
  const suffix = Date.now()
  const requiredName = `Blocker ${suffix}`
  const taskName = `Blocked ${suffix}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(requiredName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  // taskName is now selected in the detail panel.
  await page.getByRole('button', { name: 'Add requirement…' }).click()
  await page.getByRole('button', { name: requiredName, exact: true }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await selectExecuteTask(page, taskName)
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText(/cannot be time-tracked until its prerequisites/i)).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText('Tracking')).not.toBeVisible()
})

test('"No, stop the timer" stops without marking done, task selectable again', async ({
  page,
}) => {
  const taskName = `Timer resume ${Date.now()}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await selectExecuteTask(page, taskName)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'No, stop the timer' }).click()
  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()
  await expect(page.getByText('Tracking')).not.toBeVisible()

  // Still in_progress, so it remains offered as an option when reopened.
  await pickerTrigger(page).click()
  await expect(pickerOptions(page).getByRole('button', { name: taskName, exact: true })).toBeVisible()
})
