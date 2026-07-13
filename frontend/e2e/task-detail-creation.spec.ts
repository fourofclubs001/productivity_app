import { test, expect } from '@playwright/test'

test('creating a task auto-selects it, and a child task can be created from the detail view', async ({
  page,
}) => {
  await page.goto('/')

  const parentName = `Parent ${Date.now()}`
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(parentName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByTitle('red').click()
  await page.getByRole('button', { name: 'Create' }).click()

  // The newly created task is auto-selected in the detail panel.
  await expect(page.getByLabel('Task name')).toHaveValue(parentName)
  // Description textarea has been removed from the detail view.
  await expect(page.getByText('Description', { exact: true })).not.toBeVisible()
  // The color chosen at creation is already active (border highlighted).
  await expect(page.getByRole('button', { name: 'red' })).toHaveClass(/border-text-primary/)

  const childName = `Child ${Date.now()}`
  await page.getByTitle('Create child task').click()
  await expect(page.getByRole('heading', { name: 'New sub-task' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill(childName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  // The child is now auto-selected, and shows up as the parent's only child in the tree.
  await expect(page.getByLabel('Task name')).toHaveValue(childName)
  const tree = page.getByTestId('task-tree')
  const parentRow = tree.locator('.group', { hasText: parentName })
  await parentRow.getByRole('button').first().click() // expand chevron
  await expect(tree.getByText(childName)).toBeVisible()
})
