import { test, expect } from '@playwright/test'

test('Evaluate Metrics subtab: granularity switch and task filter', async ({ page }) => {
  const taskAName = `Metrics A ${Date.now()}`
  const taskBName = `Metrics B ${Date.now()}`

  await page.goto('/')

  // Create and track task A briefly (executed time, no plan).
  await page.getByTitle('New task').click()
  await page.getByLabel('Name').fill(taskAName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByTitle('New task').click()
  await page.getByLabel('Name').fill(taskBName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByRole('combobox').selectOption({ label: taskAName })
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'No, keep in progress' }).click()

  await page.getByRole('button', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Metrics', exact: true }).click()

  // Both subtab controls are present.
  await expect(page.getByRole('button', { name: 'Day' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Week' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Month' })).toBeVisible()

  const taskACell = page.getByRole('cell', { name: taskAName })
  await expect(taskACell).toBeVisible()

  // Filter down to only task B, which has no data this period - task A's row
  // should disappear and totals should reflect the (empty) selection.
  await page.getByRole('button', { name: /Tasks:/ }).click()
  await page.getByText(taskBName, { exact: false }).click()
  await page.getByText('BY TASK').click() // close the picker (click outside)

  await expect(page.getByText(/nothing planned or executed/i)).toBeVisible()
  await expect(taskACell).not.toBeVisible()

  // Clear the filter and task A's data should reappear.
  await page.getByRole('button', { name: /Tasks:/ }).click()
  await page.getByText('Clear filter').click()
  await page.getByText('BY TASK').click() // close the picker again
  await expect(taskACell).toBeVisible()

  // Switching granularity shouldn't error, and "today" still includes the
  // entry tracked moments ago.
  await page.getByRole('button', { name: 'Day' }).click()
  await expect(taskACell).toBeVisible()
})
