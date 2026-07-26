import { test, expect } from '@playwright/test'

test('Execute picker and Evaluate filter group recurrent tasks under their own section', async ({
  page,
}) => {
  const taskName = `RecurDropdown ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await page.getByTitle('New recurrent item').click()
  await page.getByRole('button', { name: 'Recurrent task', exact: true }).click()
  await page.getByLabel('Name').fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('recurrent-tasks-list').getByText(taskName, { exact: true })).toBeVisible()

  // --- Execute picker ---
  await page.getByRole('button', { name: 'Execute' }).click()
  const trigger = page.getByTestId('task-picker-trigger')
  const options = page.getByTestId('task-picker-options')
  await trigger.click()

  await expect(options.getByText('Tasks', { exact: true })).toBeVisible()
  await expect(options.getByText('Recurrent tasks', { exact: true })).toBeVisible()
  await expect(options.getByRole('button', { name: taskName, exact: true })).toBeVisible()

  await options.getByRole('button', { name: taskName, exact: true }).click()
  await expect(trigger).toHaveText(taskName)

  // --- Evaluate Metrics filter ---
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Metrics', exact: true }).click()
  await page.getByRole('button', { name: /Tasks:/ }).click()
  const filterPanel = page.locator('div.absolute', { hasText: 'Recurrent tasks' })
  await expect(filterPanel.getByText('Tasks', { exact: true })).toBeVisible()
  await expect(filterPanel.getByText('Recurrent tasks', { exact: true })).toBeVisible()
  await expect(filterPanel.getByRole('checkbox', { name: taskName })).toBeVisible()
})
