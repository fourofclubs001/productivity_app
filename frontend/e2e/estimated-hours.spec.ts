import { test, expect, type APIRequestContext } from '@playwright/test'
import { todayAt } from './helpers/time'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string, parentIds: string[] = []) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done', parent_ids: parentIds },
  })
  return response.json()
}

test('a leaf estimate (set server-side) rolls up to its parent', async ({ page, request }) => {
  // Per v02 item 12, the manual "Estimated hours" input was removed from
  // the detail panel -- the calendar itself is now the only UI-driven
  // source of a leaf's committed time. Existing stored estimates (e.g. set
  // before this change, or via the API directly) still roll up to parents,
  // so seed them the same way the now-removed UI used to.
  const suffix = Date.now()
  const parent = await createTask(request, `Goal ${suffix}`)
  const childA = await createTask(request, `A ${suffix}`, [parent.id])
  const childB = await createTask(request, `B ${suffix}`, [parent.id])
  await request.patch(`${API_BASE}/tasks/${childA.id}`, { data: { estimated_hours: 2 } })
  await request.patch(`${API_BASE}/tasks/${childB.id}`, { data: { estimated_hours: 1.5 } })

  await page.goto('/')

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
