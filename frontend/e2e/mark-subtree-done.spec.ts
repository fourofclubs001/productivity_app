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

test('right-click "Mark as done" on a goal marks its whole subtree done, undoable in one step', async ({
  page,
}) => {
  const suffix = Date.now()
  const goalName = `Subtree Goal ${suffix}`
  const leafAName = `Subtree Leaf A ${suffix}`
  const leafBName = `Subtree Leaf B ${suffix}`

  await page.goto('/')

  await createTask(page, goalName)
  await page.getByTestId('task-tree').getByText(goalName).click()
  await createChild(page, leafAName)
  await page.getByTestId('task-tree').getByText(goalName).click()
  await createChild(page, leafBName)

  const tree = page.getByTestId('task-tree')
  const rowGoal = tree.locator('.group', { hasText: goalName })
  await rowGoal.getByRole('button').first().click() // expand goal

  // Both leaves start in backlog (never tracked), which mark-done alone
  // would reject -- the bulk action must force them done anyway.
  await expect(tree.getByText(leafAName)).toBeVisible()
  await expect(tree.getByText(leafBName)).toBeVisible()

  await tree.getByText(goalName).click({ button: 'right' })
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click()

  // Both leaves are now hidden from the Plan tree (sprint_done leaves are
  // always hidden, per isHiddenFromPlan) -- confirms the cascade worked.
  await expect(tree.getByText(leafAName)).not.toBeVisible()
  await expect(tree.getByText(leafBName)).not.toBeVisible()

  // A single Ctrl+Z reverts the whole cascade in one step, not leaf-by-leaf.
  await page.keyboard.press('Control+z')
  await expect(tree.getByText(leafAName)).toBeVisible()
  await expect(tree.getByText(leafBName)).toBeVisible()
})

test('right-click "Mark as done" on a leaf marks just that leaf (no-op subtree of itself)', async ({
  page,
}) => {
  const leafName = `Subtree Solo Leaf ${Date.now()}`
  await page.goto('/')
  await createTask(page, leafName)

  const tree = page.getByTestId('task-tree')
  await tree.getByText(leafName).click({ button: 'right' })
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click()

  await expect(tree.getByText(leafName)).not.toBeVisible()
})
