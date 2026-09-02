import { test, expect } from '@playwright/test'

test('the Evaluate task filter groups recurrent tasks under their own section', async ({
  page,
}) => {
  const recurName = `RecurDropdown ${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Recurrent tasks' }).click()
  await page.getByTitle('New recurrent item').click()
  await page.getByRole('button', { name: 'Recurrent task', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill(recurName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(
    page.getByTestId('recurrent-tasks-list').getByText(recurName, { exact: true }),
  ).toBeVisible()

  // The reusable TaskPicker's own "Tasks" / "Recurrent tasks" sectioning is
  // covered by src/components/timer/TaskPicker.test.tsx; here we check the
  // Evaluate Metrics task filter, which shares the same structure.
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Metrics', exact: true }).click()
  await page.getByRole('button', { name: /Tasks:/ }).click()
  const filterPanel = page.locator('div.absolute', { hasText: 'Recurrent tasks' })
  await expect(filterPanel.getByText('Tasks', { exact: true })).toBeVisible()
  await expect(filterPanel.getByText('Recurrent tasks', { exact: true })).toBeVisible()
  await expect(filterPanel.getByRole('checkbox', { name: recurName })).toBeVisible()
})
