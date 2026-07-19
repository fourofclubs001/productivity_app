import { test, expect } from '@playwright/test'
import { todayAt } from './helpers/time'

const API_BASE = 'http://localhost:8001'

async function createTask(page: import('@playwright/test').Page, name: string) {
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('task-tree').getByText(name)).toBeVisible()
}

async function deleteViaOptionsMenu(page: import('@playwright/test').Page) {
  await page.getByTitle('Options').click()
  await page.getByRole('button', { name: 'Delete task' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
}

test('blocks deleting a task while its timer is running', async ({ page }) => {
  const taskName = `Timer guard ${Date.now()}`
  const tree = () => page.getByTestId('task-tree')

  await page.goto('/')
  await createTask(page, taskName)

  await tree().getByText(taskName).click()
  await deleteViaOptionsMenu(page)
  await expect(tree().getByText(taskName)).not.toBeVisible()

  // Recreate it and start its timer this time.
  await createTask(page, taskName)
  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByTestId('task-picker-trigger').click()
  await page.getByTestId('task-picker-options').getByRole('button', { name: taskName, exact: true }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Tracking')).toBeVisible()

  await page.getByRole('button', { name: 'Plan' }).click()
  await tree().getByText(taskName).click()
  await deleteViaOptionsMenu(page)

  await expect(page.getByText(/timer is currently running/i)).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(tree().getByText(taskName)).toBeVisible()

  // Stop the timer, then deletion should succeed.
  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'No, keep in progress' }).click()

  await page.getByRole('button', { name: 'Plan' }).click()
  await tree().getByText(taskName).click()
  await deleteViaOptionsMenu(page)
  await expect(tree().getByText(taskName)).not.toBeVisible()
})

test('right-clicking a Plan tree row opens a Delete context menu', async ({ page }) => {
  const taskName = `Right-click delete ${Date.now()}`
  const tree = () => page.getByTestId('task-tree')

  await page.goto('/')
  await createTask(page, taskName)

  await tree().getByText(taskName).click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(`Delete "${taskName}" permanently?`)).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(tree().getByText(taskName)).toBeVisible()

  await tree().getByText(taskName).click({ button: 'right' })
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(`Delete "${taskName}" permanently?`)).not.toBeVisible()
  await expect(tree().getByText(taskName)).not.toBeVisible()
})

test('deleting a task removes its future-scheduled chip from the calendar', async ({
  page,
  request,
}) => {
  const taskName = `Delete cleanup ${Date.now()}`
  const task = await (
    await request.post(`${API_BASE}/tasks`, { data: { name: taskName, definition_of_done: 'd' } })
  ).json()
  const start = todayAt(9)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  await request.post(`${API_BASE}/intervals`, {
    data: { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
  })

  await page.goto('/')
  await expect(page.locator('.rbc-event', { hasText: taskName })).toBeVisible()

  await page.getByTestId('task-tree').getByText(taskName).click()
  await deleteViaOptionsMenu(page)

  await expect(page.locator('.rbc-event', { hasText: taskName })).not.toBeVisible()
})
