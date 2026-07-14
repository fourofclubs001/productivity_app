import { test, expect, type APIRequestContext } from '@playwright/test'
import { todayAt } from './helpers/time'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string, parentIds: string[] = []) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done', parent_ids: parentIds },
  })
  return response.json()
}

test('setting an estimate on a leaf rolls up to its parent', async ({ page, request }) => {
  const suffix = Date.now()
  const parent = await createTask(request, `Goal ${suffix}`)
  const childA = await createTask(request, `A ${suffix}`, [parent.id])
  const childB = await createTask(request, `B ${suffix}`, [parent.id])

  await page.goto('/')

  const tree = page.getByTestId('task-tree')
  const parentRow = tree.locator('.group', { hasText: parent.name })
  await parentRow.getByRole('button').first().click() // expand chevron

  await tree.getByText(childA.name, { exact: true }).click()
  await page.getByLabel('Estimated hours').fill('2')
  await page.getByText('Save changes').click()
  await expect(page.getByLabel('Task name')).toHaveValue(childA.name)

  await page.getByTestId('task-tree').getByText(childB.name, { exact: true }).click()
  await page.getByLabel('Estimated hours').fill('1.5')
  await page.getByText('Save changes').click()

  await page.getByTestId('task-tree').getByText(parent.name, { exact: true }).click()
  await expect(page.getByText('3.5h (sum of sub-tasks)')).toBeVisible()
})

test('hours covered reflects a scheduled interval', async ({ page, request }) => {
  const task = await createTask(request, `Coverage ${Date.now()}`)
  const start = todayAt(9)
  const end = new Date(start.getTime() + 90 * 60 * 1000)
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
  })

  await page.goto('/')
  await page.getByTestId('task-tree').getByText(task.name, { exact: true }).click()

  await expect(page.getByText('1.5h currently on the calendar')).toBeVisible()
})
