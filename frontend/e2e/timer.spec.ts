import { test, expect } from '@playwright/test'

test('stops immediately on click and only marks done via explicit choice', async ({ page }) => {
  const taskName = `Timer flow ${Date.now()}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('task-tree').getByText(taskName)).toBeVisible()

  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByRole('combobox').selectOption({ label: taskName })
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
  const options = await page.getByRole('combobox').locator('option').allTextContents()
  expect(options).not.toContain(taskName)
})

test('ctrl+z after marking done reverts the task back to in_progress', async ({ page }) => {
  const taskName = `Timer undo ${Date.now()}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByRole('combobox').selectOption({ label: taskName })
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'Yes, done' }).click()
  await expect(page.getByText(/stopped/i)).not.toBeVisible()

  let options = await page.getByRole('combobox').locator('option').allTextContents()
  expect(options).not.toContain(taskName)

  await page.keyboard.press('Control+z')

  // Reverted to in_progress, so it's selectable in the timer picker again.
  await expect.poll(async () => {
    options = await page.getByRole('combobox').locator('option').allTextContents()
    return options
  }).toContain(taskName)
})

test('stopping without marking done keeps the task selectable again', async ({ page }) => {
  const taskName = `Timer resume ${Date.now()}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByRole('combobox').selectOption({ label: taskName })
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'No, keep in progress' }).click()

  const options = await page.getByRole('combobox').locator('option').allTextContents()
  expect(options).toContain(taskName)
})
