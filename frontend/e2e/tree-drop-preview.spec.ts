import { test, expect, type APIRequestContext } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

async function createTask(request: APIRequestContext, name: string) {
  const response = await request.post(`${API_BASE}/tasks`, {
    data: { name, definition_of_done: 'done' },
  })
  return response.json()
}

test('shows a live reparent outline mid-drag over the middle third, then a reorder line over an outer third', async ({
  page,
  request,
}) => {
  const suffix = Date.now()
  // Created B before A, so the default order lists B first -- makes the
  // eventual "drag A to just before B" drop a real, verifiable change
  // rather than a no-op that happens to already match creation order.
  const taskB = await createTask(request, `PreviewB ${suffix}`)
  const taskA = await createTask(request, `PreviewA ${suffix}`)

  await page.goto('/')

  const tree = page.getByTestId('task-tree')
  const rowA = tree.locator('.group', { hasText: taskA.name })
  const rowB = tree.locator('.group', { hasText: taskB.name })

  await rowA.scrollIntoViewIfNeeded()
  await rowB.scrollIntoViewIfNeeded()

  const boxA = await rowA.boundingBox()
  const boxB = await rowB.boundingBox()
  if (!boxA || !boxB) throw new Error('rows not found')

  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2)
  await page.mouse.down()

  // Hover the middle third of B -- the reparent zone. No line, just the
  // full-row outline, and nothing has actually moved yet (still mid-drag).
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, { steps: 10 })
  await expect(rowB).toHaveClass(/ring-accent/)
  await expect(page.getByTestId('drop-reorder-line')).not.toBeVisible()

  // Move to B's top edge -- the reorder zone. The outline goes away in
  // favor of a thin line at the shared boundary, still before any drop.
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height * 0.1, { steps: 10 })
  await expect(rowB).not.toHaveClass(/ring-accent/)
  const line = page.getByTestId('drop-reorder-line')
  await expect(line).toBeVisible()
  await expect(line).toHaveClass(/top-0/)

  // Actually drop here -- a real reorder (A moves to just before B), and the
  // preview line must not linger once the drag has ended.
  await page.mouse.up()
  await expect(page.getByTestId('drop-reorder-line')).not.toBeVisible()

  await expect
    .poll(async () => {
      const names = (await tree.locator('span.flex-1').allTextContents()).map((n) => n.trim())
      return names.filter((n) => [taskA.name, taskB.name].includes(n))
    })
    .toEqual([taskA.name, taskB.name])
})
