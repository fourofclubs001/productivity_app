import { test, expect } from '@playwright/test'

test('Evaluate lists mirror the Plan panel tree shape', async ({ page }) => {
  const parentName = `TreeM12 Parent ${Date.now()}`
  const childName = `TreeM12 Child ${Date.now()}`

  await page.goto('/')

  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(parentName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByTitle('Add child task').click()
  await page.getByRole('button', { name: 'Create new task' }).click()
  await page.getByLabel('Name', { exact: true }).fill(childName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  // Track the child briefly so the parent shows up in Metrics.
  await page.getByRole('button', { name: 'Start timer' }).click()
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.getByRole('button', { name: 'No, stop the timer' }).click()

  // --- Evaluate Metrics: tree shape mirrors Plan ---
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Metrics', exact: true }).click()

  const parentCell = page.getByRole('cell', { name: parentName })
  await expect(parentCell).toBeVisible()
  // The child starts collapsed under its parent, matching the Plan default.
  await expect(page.getByRole('cell', { name: childName })).not.toBeVisible()

  await parentCell.getByRole('button').first().click()
  await expect(page.getByRole('cell', { name: childName })).toBeVisible()

  // --- Evaluate task filter: parent shown for navigation, child nested ---
  await page.getByRole('button', { name: /Tasks:/ }).click()
  const filterPanel = page.locator('div.absolute', { hasText: parentName })
  await expect(filterPanel.getByText(parentName)).toBeVisible()
  await expect(filterPanel.getByText(childName)).not.toBeVisible()
})
