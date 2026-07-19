import { test, expect } from '@playwright/test'

async function createTask(page: import('@playwright/test').Page, name: string) {
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByLabel('Task name')).toHaveValue(name)
}

async function addRequirement(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('button', { name: 'Add requirement…' }).click()
  await page.getByRole('button', { name: label, exact: true }).click()
}

test('a task can be marked as requiring another, then the requirement removed', async ({
  page,
}) => {
  const suffix = Date.now()
  const taskName = `Task ${suffix}`
  const requiredName = `Required ${suffix}`

  await page.goto('/')
  await createTask(page, requiredName)
  await createTask(page, taskName)
  // taskName is now selected/auto-focused in the detail panel.

  await addRequirement(page, requiredName)

  const panel = page.getByTestId('task-detail-panel')
  await expect(panel.locator('span', { hasText: requiredName })).toBeVisible()

  await page.getByTitle('Remove requirement').click()
  await expect(panel.getByText('No prerequisites')).toBeVisible()
})

test('the Requires picker renders as an indented tree and allows selecting a goal (non-leaf) task', async ({
  page,
}) => {
  const suffix = Date.now()
  const goalName = `Goal ${suffix}`
  const childName = `Goal child ${suffix}`
  const taskName = `Task ${suffix}`

  await page.goto('/')
  await createTask(page, goalName)
  await page.getByTitle('Create child task').click()
  await page.getByLabel('Name', { exact: true }).fill(childName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await createTask(page, taskName)
  // taskName is selected; open the Requires picker and pick the goal itself.
  await page.getByRole('button', { name: 'Add requirement…' }).click()
  await expect(page.getByTestId('task-picker-options').getByText(goalName)).toBeVisible()
  await page.getByTestId('task-picker-options').getByRole('button', { name: goalName, exact: true }).click()

  const panel = page.getByTestId('task-detail-panel')
  await expect(panel.locator('span', { hasText: goalName })).toBeVisible()
})

test('adding a requirement that would create a cycle is rejected with a dialog', async ({
  page,
}) => {
  const suffix = Date.now()
  const aName = `LoopA ${suffix}`
  const bName = `LoopB ${suffix}`

  await page.goto('/')
  await createTask(page, bName)
  await createTask(page, aName)
  // A is selected. Make A require B.
  await addRequirement(page, bName)
  const panel = page.getByTestId('task-detail-panel')
  await expect(panel.locator('span', { hasText: bName })).toBeVisible()

  // Now select B and try to make it require A -- would close a cycle.
  await page.getByTestId('task-tree').getByText(bName).click()
  await expect(page.getByLabel('Task name')).toHaveValue(bName)
  await addRequirement(page, aName)

  await expect(page.getByText(/cycle/i)).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText(/cycle/i)).not.toBeVisible()
})
