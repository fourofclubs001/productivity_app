import { test, expect } from '@playwright/test'

async function createTask(page: import('@playwright/test').Page, name: string) {
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('task-tree').getByText(name)).toBeVisible()
}

test('blocks deleting a task while its timer is running', async ({ page }) => {
  const taskName = `Timer guard ${Date.now()}`
  const tree = () => page.getByTestId('task-tree')

  await page.goto('/')
  await createTask(page, taskName)

  await tree().getByText(taskName).click()
  await page.getByText('Delete task').click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(tree().getByText(taskName)).not.toBeVisible()

  // Recreate it and start its timer this time.
  await createTask(page, taskName)
  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByRole('combobox').selectOption({ label: taskName })
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Tracking')).toBeVisible()

  await page.getByRole('button', { name: 'Plan' }).click()
  await tree().getByText(taskName).click()
  await page.getByText('Delete task').click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByText(/timer is currently running/i)).toBeVisible()
  await expect(tree().getByText(taskName)).toBeVisible()

  // Stop the timer, then deletion should succeed.
  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'No, keep in progress' }).click()

  await page.getByRole('button', { name: 'Plan' }).click()
  await tree().getByText(taskName).click()
  await page.getByText('Delete task').click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(tree().getByText(taskName)).not.toBeVisible()
})
