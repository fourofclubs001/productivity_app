import { test, expect, type APIRequestContext } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done' },
  })
  return response.json()
}

test('dragging one task onto another reparents it (move semantics)', async ({ page, request }) => {
  const suffix = Date.now()
  const taskA = await createTask(request, `DragA ${suffix}`)
  const taskB = await createTask(request, `DragB ${suffix}`)

  await page.goto('/')

  const tree = page.getByTestId('task-tree')
  const rowA = tree.locator('.group', { hasText: taskA.name })
  const rowB = tree.locator('.group', { hasText: taskB.name })

  await rowA.scrollIntoViewIfNeeded()
  await rowB.scrollIntoViewIfNeeded()

  const boxA = await rowA.boundingBox()
  const boxB = await rowB.boundingBox()
  if (!boxA || !boxB) throw new Error('rows not found')

  // Drag A onto the middle of B -- the outer thirds are reorder zones, so
  // targeting the vertical center specifically exercises the reparent path.
  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2)
  await page.mouse.down()
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, { steps: 10 })
  await page.mouse.up()

  // A is no longer a root row (it moved under B) -- expand B to find it.
  await expect(rowA).not.toBeVisible()
  await rowB.getByRole('button').first().click()
  await expect(tree.getByText(taskA.name)).toBeVisible()
})

test('dragging a task near the edge of another reorders siblings without reparenting', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  const taskX = await createTask(request, `ReorderX ${suffix}`)
  const taskY = await createTask(request, `ReorderY ${suffix}`)
  const taskZ = await createTask(request, `ReorderZ ${suffix}`)
  // Created in order X, Y, Z -- default order should list them that way.

  await page.goto('/')

  const tree = page.getByTestId('task-tree')
  const rowZ = tree.locator('.group', { hasText: taskZ.name })
  const rowX = tree.locator('.group', { hasText: taskX.name })

  // The tree panel scrolls, and by this point in the run many tasks from
  // earlier specs have accumulated -- ensure both rows are actually in view
  // (they're adjacent, being created back-to-back, so one scroll settles both).
  await rowZ.scrollIntoViewIfNeeded()
  await rowX.scrollIntoViewIfNeeded()

  const boxZ = await rowZ.boundingBox()
  const boxX = await rowX.boundingBox()
  if (!boxZ || !boxX) throw new Error('rows not found')

  // Drag Z to just under X's top edge (top quartile) -- should insert Z
  // immediately before X, without making it X's child.
  await page.mouse.move(boxZ.x + boxZ.width / 2, boxZ.y + boxZ.height / 2)
  await page.mouse.down()
  await page.mouse.move(boxX.x + boxX.width / 2, boxX.y + boxX.height * 0.1, { steps: 10 })
  await page.mouse.up()

  // The reorder mutation + refetch happen asynchronously after mouse.up(),
  // so poll until the DOM reflects it rather than asserting immediately.
  await expect
    .poll(async () => {
      const names = (await tree.locator('span.flex-1').allTextContents()).map((n) => n.trim())
      return names.filter((n) => [taskX.name, taskY.name, taskZ.name].includes(n))
    })
    .toEqual([taskZ.name, taskX.name, taskY.name])
})
