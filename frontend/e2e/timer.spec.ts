import { test, expect, type Page } from '@playwright/test'

function faviconHref(page: Page) {
  return page.locator('link[rel="icon"]').evaluate((el) => (el as HTMLLinkElement).href)
}

// Timer start/stop moved out of the (removed) Execute tab: Start lives on
// the task's detail panel, the running readout + Stop live in the nav bar
// (v08 item 4/5).
async function createTaskAndStart(page: Page, taskName: string) {
  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  // The new task is auto-selected in the detail panel.
  await page.getByRole('button', { name: 'Start timer' }).click()
  await expect(page.getByText('Tracking')).toBeVisible()
}

function navStop(page: Page) {
  return page.getByRole('button', { name: 'Stop', exact: true })
}

test('Stop opens a confirm dialog before stopping anything, then Yes marks done', async ({
  page,
}) => {
  const taskName = `Timer flow ${Date.now()}`
  await createTaskAndStart(page, taskName)

  await navStop(page).click()
  // Clicking Stop only opens the confirm dialog -- still "Tracking" until an
  // explicit choice is made.
  await expect(page.getByText('Is the definition of done fulfilled?')).toBeVisible()
  await expect(page.getByText('Tracking')).toBeVisible()

  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()
  await expect(page.getByText('Tracking')).not.toBeVisible()

  // Once sprint_done, the (still-selected) detail panel no longer offers to
  // start a timer.
  await expect(page.getByRole('button', { name: 'Start timer' })).not.toBeVisible()
})

test('Cancel leaves the timer running untouched', async ({ page }) => {
  const taskName = `Timer abort ${Date.now()}`
  await createTaskAndStart(page, taskName)

  await navStop(page).click()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()
  await expect(page.getByText('Tracking')).toBeVisible()

  // The active timer is a single global key -- stop it for real so it
  // doesn't leak into later tests.
  await navStop(page).click()
  await page.getByRole('button', { name: 'No, stop the timer' }).click()
})

test('ctrl+z after marking done reverts the task back to in_progress', async ({ page }) => {
  const taskName = `Timer undo ${Date.now()}`
  await createTaskAndStart(page, taskName)

  await navStop(page).click()
  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Start timer' })).not.toBeVisible()

  await page.keyboard.press('Control+z')

  // Reverted to in_progress, so the still-selected detail panel offers Start
  // again.
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible()
})

test('starting a timer on a task with an unmet prerequisite is rejected with a dialog', async ({
  page,
}) => {
  const suffix = Date.now()
  const requiredName = `Blocker ${suffix}`
  const taskName = `Blocked ${suffix}`

  await page.goto('/')
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(requiredName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  // taskName is now selected in the detail panel.
  await page.getByRole('button', { name: 'Add requirement…' }).click()
  await page.getByRole('button', { name: requiredName, exact: true }).click()

  await page.getByRole('button', { name: 'Start timer' }).click()
  await expect(page.getByText(/cannot be time-tracked until its prerequisites/i)).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText('Tracking')).not.toBeVisible()
})

test('"No, stop the timer" stops without marking done', async ({ page }) => {
  const taskName = `Timer resume ${Date.now()}`
  await createTaskAndStart(page, taskName)

  await navStop(page).click()
  await page.getByRole('button', { name: 'No, stop the timer' }).click()
  await expect(page.getByText('Is the definition of done fulfilled?')).not.toBeVisible()
  await expect(page.getByText('Tracking')).not.toBeVisible()

  // Still in_progress, so Start is offered again.
  await page.getByTestId('task-tree').getByText(taskName).click()
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible()
})

test('tab title shows the live elapsed time while tracking, and the favicon only ever alternates neutral/green', async ({
  page,
}) => {
  const taskName = `Timer title ${Date.now()}`

  await page.goto('/')
  const neutralHref = await faviconHref(page)
  await expect(page).toHaveTitle('Productivity App')

  await createTaskAndStart(page, taskName)

  // Live elapsed time ahead of the app name -- mm:ss below an hour, h:mm:ss
  // from an hour on (this short session stays in mm:ss).
  await expect(page).toHaveTitle(/^\d{1,2}:\d{2}(:\d{2})? · Productivity App$/)
  const trackingHref = await faviconHref(page)
  expect(trackingHref).toMatch(/^data:image\/png/)
  expect(trackingHref).not.toBe(neutralHref)

  await navStop(page).click()
  await page.getByRole('button', { name: 'No, stop the timer' }).click()
  await expect(page.getByText('Tracking')).not.toBeVisible()

  await expect(page).toHaveTitle('Productivity App')
  await expect.poll(() => faviconHref(page)).toBe(neutralHref)
})
