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

test('attaching an existing task as a child moves it (reparent), and cyclic picks are excluded', async ({
  page,
}) => {
  const suffix = Date.now()
  const goalAName = `Attach A ${suffix}`
  const goalBName = `Attach B ${suffix}`
  const leafCName = `Attach C ${suffix}`
  const leafDName = `Attach D ${suffix}` // stays under B, so B keeps a child

  await page.goto('/')

  await createTask(page, goalAName)
  await createTask(page, goalBName)

  // Create leaves C and D as children of B.
  await page.getByTestId('task-tree').getByText(goalBName).click()
  await createChild(page, leafDName)
  await page.getByTestId('task-tree').getByText(goalBName).click()
  await createChild(page, leafCName)

  // From A's detail panel, attach C as an existing child (moving it from B).
  await page.getByTestId('task-tree').getByText(goalAName).click()
  await page.getByTitle('Add child task').click()
  await page.getByRole('button', { name: 'Attach existing task' }).click()
  const attachDialog = page.getByTestId('attach-existing-child-dialog')
  await attachDialog.getByTestId('task-picker-trigger').click()
  const attachOptions = attachDialog.getByTestId('task-picker-options')
  // C is nested under B in the picker's tree too -- expand B's row first.
  await attachOptions
    .getByRole('button', { name: goalBName, exact: true })
    .locator('..')
    .getByRole('button')
    .first()
    .click()
  await attachOptions.getByRole('button', { name: leafCName, exact: true }).click()

  const tree = page.getByTestId('task-tree')

  // C now renders under A, and only under A -- expanding both A and B, C
  // shows up exactly once (moved, not duplicated), while D is still under B.
  const rowA = tree.locator('.group', { hasText: goalAName })
  await rowA.getByRole('button').first().click() // expand A
  const rowB = tree.locator('.group', { hasText: goalBName })
  await rowB.getByRole('button').first().click() // expand B
  await expect(tree.getByText(leafCName)).toHaveCount(1)
  await expect(tree.getByText(leafDName)).toBeVisible()

  // Attempting the reverse (attach A as a child of C, which is now under A)
  // would be a cycle -- confirm the picker excludes it rather than the
  // mutation raising a raw backend error.
  await tree.getByText(leafCName).click()
  await page.getByTitle('Add child task').click()
  await page.getByRole('button', { name: 'Attach existing task' }).click()
  const secondAttachDialog = page.getByTestId('attach-existing-child-dialog')
  await secondAttachDialog.getByTestId('task-picker-trigger').click()
  await expect(
    secondAttachDialog
      .getByTestId('task-picker-options')
      .getByRole('button', { name: goalAName, exact: true }),
  ).not.toBeVisible()
})
