import { test, expect } from '@playwright/test'

test('Execute picker and Evaluate lists mirror the Plan panel tree shape', async ({ page }) => {
  const parentName = `TreeM12 Parent ${Date.now()}`
  const childName = `TreeM12 Child ${Date.now()}`

  await page.goto('/')

  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(parentName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByTitle('Create child task').click()
  await page.getByLabel('Name', { exact: true }).fill(childName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  // --- Execute: item 25 ---
  await page.getByRole('button', { name: 'Execute' }).click()
  const trigger = page.getByTestId('task-picker-trigger')
  const options = page.getByTestId('task-picker-options')

  await trigger.click()
  await expect(options.getByText(parentName)).toBeVisible()
  // Parent rows are shown for navigation only -- not a clickable leaf option.
  await expect(options.getByRole('button', { name: parentName, exact: true })).not.toBeVisible()
  await expect(options.getByRole('button', { name: childName, exact: true })).not.toBeVisible()

  // Expand the parent's chevron to reveal the child leaf.
  const parentRow = options.locator('div', { hasText: parentName }).first()
  await parentRow.getByRole('button').first().click()
  await expect(options.getByRole('button', { name: childName, exact: true })).toBeVisible()

  await options.getByRole('button', { name: childName, exact: true }).click()
  await expect(trigger).toHaveText(childName)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'No, stop the timer' }).click()

  // --- Evaluate Metrics: items 26/28 ---
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Metrics', exact: true }).click()

  const parentCell = page.getByRole('cell', { name: parentName })
  await expect(parentCell).toBeVisible()
  // The child starts collapsed under its parent, matching the Plan default.
  await expect(page.getByRole('cell', { name: childName })).not.toBeVisible()

  await parentCell.getByRole('button').first().click()
  await expect(page.getByRole('cell', { name: childName })).toBeVisible()

  // --- Evaluate task filter: item 29 ---
  await page.getByRole('button', { name: /Tasks:/ }).click()
  const filterPanel = page.locator('div.absolute', { hasText: parentName })
  await expect(filterPanel.getByText(parentName)).toBeVisible()
  await expect(filterPanel.getByText(childName)).not.toBeVisible()
})
