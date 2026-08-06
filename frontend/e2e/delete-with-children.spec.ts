import { test, expect } from '@playwright/test'

async function createTask(page: import('@playwright/test').Page, name: string) {
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
}

async function createChild(page: import('@playwright/test').Page, name: string) {
  await page.getByTitle('Add child task').click()
  await page.getByRole('button', { name: 'Create new task' }).click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
}

test('deleting a goal task offers "just this task" vs "whole subtree"', async ({ page }) => {
  const suffix = Date.now()
  const grandparentName = `Del GP ${suffix}`
  const middleName = `Del Middle ${suffix}`
  const leafName = `Del Leaf ${suffix}`

  await page.goto('/')

  await createTask(page, grandparentName)
  await page.getByTestId('task-tree').getByText(grandparentName).click()
  await createChild(page, middleName)
  // middleName now selected; add its own child leaf.
  await createChild(page, leafName)

  const tree = page.getByTestId('task-tree')

  // Middle is auto-selected right after creation (used to add the leaf
  // child above), but the tree row itself is collapsed under grandparent --
  // expand it before clicking the row directly.
  const rowGPBefore = tree.locator('.group', { hasText: grandparentName })
  await rowGPBefore.getByRole('button').first().click()

  // "Just this task": deleting the middle goal reparents the leaf up to
  // the grandparent, rather than deleting it or orphaning it to root.
  await tree.getByText(middleName).click()
  await page.getByTitle('Options').click()
  await page.getByRole('button', { name: 'Delete task' }).click()
  await expect(page.getByText(/It has sub-tasks/)).toBeVisible()
  await page.getByRole('button', { name: 'Just this task' }).click()

  await expect(tree.getByText(middleName)).not.toBeVisible()
  // Grandparent is already expanded (from above) -- the leaf should now
  // show up directly under it, one level shallower than before.
  await expect(tree.getByText(leafName)).toBeVisible()
})

test('deleting a goal task with "whole subtree" removes it and all its descendants', async ({
  page,
}) => {
  const suffix = Date.now()
  const goalName = `Cascade Goal ${suffix}`
  const middleName = `Cascade Middle ${suffix}`
  const leafName = `Cascade Leaf ${suffix}`

  await page.goto('/')

  await createTask(page, goalName)
  await page.getByTestId('task-tree').getByText(goalName).click()
  await createChild(page, middleName)
  await createChild(page, leafName)

  const tree = page.getByTestId('task-tree')

  await tree.getByText(goalName).click()
  await page.getByTitle('Options').click()
  await page.getByRole('button', { name: 'Delete task' }).click()
  await page.getByRole('button', { name: 'Delete whole subtree' }).click()

  await expect(tree.getByText(goalName)).not.toBeVisible()
  await expect(tree.getByText(middleName)).not.toBeVisible()
  await expect(tree.getByText(leafName)).not.toBeVisible()
})
