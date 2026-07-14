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

test('stops immediately on click and only marks done via explicit choice', async ({ page }) => {
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
  // The clock is frozen immediately: the "Stopped" prompt appears right away,
  // not gated behind a done/not-done choice.
  await expect(page.getByText(/stopped/i)).toBeVisible()
  await expect(page.getByText('Tracking')).not.toBeVisible()

  await page.getByRole('button', { name: 'Yes, done' }).click()
  await expect(page.getByText(/stopped/i)).not.toBeVisible()

  // Once sprint_done, the task is no longer offered in the timer picker.
  await pickerTrigger(page).click()
  await expect(pickerOptions(page).getByRole('button', { name: taskName, exact: true })).not.toBeVisible()
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
  await page.getByRole('button', { name: 'Yes, done' }).click()
  await expect(page.getByText(/stopped/i)).not.toBeVisible()

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
  await page.getByLabel('Add requirement').selectOption({ label: requiredName })
  await page.getByTitle('Add requirement').click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await selectExecuteTask(page, taskName)
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText(/cannot be time-tracked until its prerequisites/i)).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText('Tracking')).not.toBeVisible()
})

test('stopping without marking done keeps the task selectable again', async ({ page }) => {
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
  await page.getByRole('button', { name: 'No, keep in progress' }).click()

  // Still in_progress, so it remains the picker's selection and is still
  // offered as an option when reopened.
  await pickerTrigger(page).click()
  await expect(pickerOptions(page).getByRole('button', { name: taskName, exact: true })).toBeVisible()
})
