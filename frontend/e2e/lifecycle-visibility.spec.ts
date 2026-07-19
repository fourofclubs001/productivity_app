import { test, expect, type APIRequestContext } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string, parentIds: string[] = []) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done', parent_ids: parentIds },
  })
  return response.json()
}

async function markSprintDone(request: APIRequestContext, taskId: string) {
  await request.post(`${API_BASE}/timer/start`, { data: { task_id: taskId } })
  await request.post(`${API_BASE}/timer/stop`, { data: {} })
  await request.post(`${API_BASE}/timer/mark-done`, { data: { task_id: taskId } })
}

test('a sprint-done leaf is hidden, and its parent offers to be removed too', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  const parent = await createTask(request, `Goal ${suffix}`)
  const child = await createTask(request, `Leaf ${suffix}`, [parent.id])
  await markSprintDone(request, child.id)

  await page.goto('/')

  const tree = page.getByTestId('task-tree')
  await expect(tree.getByText(child.name)).not.toBeVisible()
  await expect(tree.getByText(new RegExp(`${parent.name}.*sub-tasks are all done`))).toBeVisible()
})

test('confirming removal hides the parent, and ctrl+z restores it', async ({ page, request }) => {
  const suffix = Date.now()
  const parent = await createTask(request, `Goal ${suffix}`)
  const child = await createTask(request, `Leaf ${suffix}`, [parent.id])
  await markSprintDone(request, child.id)

  await page.goto('/')
  const tree = page.getByTestId('task-tree')
  const promptText = tree.getByText(new RegExp(`${parent.name}.*sub-tasks are all done`))
  await expect(promptText).toBeVisible()
  const promptRow = promptText.locator('..')

  await promptRow.getByRole('button', { name: 'Yes' }).click()
  await expect(tree.getByText(parent.name, { exact: false })).not.toBeVisible()

  await page.keyboard.press('Control+z')
  await expect(promptText).toBeVisible()
})

test('declining removal keeps the parent visible as Backlog until a new child reopens it', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  const parent = await createTask(request, `Goal ${suffix}`)
  const child = await createTask(request, `Leaf ${suffix}`, [parent.id])
  await markSprintDone(request, child.id)

  await page.goto('/')
  const tree = page.getByTestId('task-tree')
  const promptText = tree.getByText(new RegExp(`${parent.name}.*sub-tasks are all done`))
  await expect(promptText).toBeVisible()
  await promptText.locator('..').getByRole('button', { name: 'No' }).click()

  // Parent renders normally now (not the prompt), and clicking it opens the detail panel.
  const parentRow = tree.getByText(parent.name, { exact: true }).locator('..')
  await expect(parentRow.getByText('Backlog')).toBeVisible()
  await tree.getByText(parent.name, { exact: true }).click()
  await expect(page.getByLabel('Task name')).toHaveValue(parent.name)

  await page.reload()
  await expect(page.getByTestId('task-tree').getByText(parent.name, { exact: true })).toBeVisible()
  await expect(
    page.getByTestId('task-tree').getByText(new RegExp(`${parent.name}.*sub-tasks are all done`)),
  ).not.toBeVisible()
  await expect(
    page.getByTestId('task-tree').getByText(parent.name, { exact: true }).locator('..').getByText('Backlog'),
  ).toBeVisible()

  // Adding a new, not-yet-finished child makes the override's condition go
  // false, so the badge reverts to the normal live-computed state.
  await createTask(request, `Leaf2 ${suffix}`, [parent.id])
  await page.reload()
  const parentRowAfterNewChild = page
    .getByTestId('task-tree')
    .getByText(parent.name, { exact: true })
    .locator('..')
  await expect(parentRowAfterNewChild.getByText('Backlog')).not.toBeVisible()
  await expect(parentRowAfterNewChild.getByText('In progress')).toBeVisible()
})

test('deleting a parent\'s only child outright (not completing it) also offers to keep it as backlog', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  const parent = await createTask(request, `Goal ${suffix}`)
  const child = await createTask(request, `Leaf ${suffix}`, [parent.id])

  await page.goto('/')
  const tree = page.getByTestId('task-tree')
  const parentRowGroup = tree.locator('.group', { hasText: parent.name })
  await parentRowGroup.getByRole('button').first().click() // expand chevron
  await expect(tree.getByText(child.name)).toBeVisible()

  // Delete the child outright via the API (equivalent to right-click
  // Delete on its tree row), rather than completing it.
  await request.delete(`${API_BASE}/tasks/${child.id}`)
  await page.reload()

  const promptText = tree.getByText(new RegExp(`${parent.name}.*sub-tasks are all done`))
  await expect(promptText).toBeVisible()

  await promptText.locator('..').getByRole('button', { name: 'No' }).click()
  const parentRow = tree.getByText(parent.name, { exact: true }).locator('..')
  await expect(parentRow.getByText('Backlog')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('task-tree').getByText(parent.name, { exact: true })).toBeVisible()
  await expect(
    page.getByTestId('task-tree').getByText(new RegExp(`${parent.name}.*sub-tasks are all done`)),
  ).not.toBeVisible()

  // A task the parent never had before still shows as a plain leaf, not
  // triggering the prompt -- only a childless *former* goal does.
  const untouchedLeaf = await createTask(request, `Untouched ${suffix}`)
  await page.reload()
  await expect(page.getByTestId('task-tree').getByText(untouchedLeaf.name)).toBeVisible()
  await expect(
    page.getByTestId('task-tree').getByText(new RegExp(`${untouchedLeaf.name}.*sub-tasks are all done`)),
  ).not.toBeVisible()
})
