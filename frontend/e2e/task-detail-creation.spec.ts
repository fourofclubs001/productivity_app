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
  await expect(page.getByRole('button', { name: 'red', exact: true })).toHaveClass(
    /border-text-primary/,
  )

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

test('Save/Discard render top-right next to Options, and Discard reverts an unsaved edit', async ({
  page,
}) => {
  await page.goto('/')

  const taskName = `Save-discard ${Date.now()}`
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByLabel('Task name')).toHaveValue(taskName)
  const panel = page.getByTestId('task-detail-panel')
  await expect(panel.getByText('Save changes')).not.toBeVisible()
  await expect(panel.getByText('Discard')).not.toBeVisible()

  const newName = `${taskName} edited`
  await page.getByLabel('Task name').fill(newName)

  const header = panel.locator('.mb-4.flex.items-center.justify-between')
  await expect(header.getByText('Save changes')).toBeVisible()
  await expect(header.getByText('Discard')).toBeVisible()
  await expect(header.getByTitle('Options')).toBeVisible()

  await header.getByText('Discard').click()
  await expect(page.getByLabel('Task name')).toHaveValue(taskName)
  await expect(panel.getByText('Save changes')).not.toBeVisible()
  await expect(panel.getByText('Discard')).not.toBeVisible()

  await page.getByLabel('Task name').fill(newName)
  await header.getByText('Save changes').click()
  await expect(panel.getByText('Save changes')).not.toBeVisible()

  // Confirm the save actually persisted server-side by re-selecting the task from the tree.
  const tree = page.getByTestId('task-tree')
  await tree.getByText(newName).click()
  await expect(page.getByLabel('Task name')).toHaveValue(newName)
})
