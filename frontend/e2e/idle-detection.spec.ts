import { test, expect } from '@playwright/test'

function faviconHref(page: import('@playwright/test').Page) {
  return page.locator('link[rel="icon"]').evaluate((el) => (el as HTMLLinkElement).href)
}

test('idle detection auto-stops the timer, driving the favicon through green -> red -> neutral', async ({
  page,
}) => {
  // Virtualize time before any page script runs, per Playwright's clock
  // ordering requirement -- lets us fast-forward past the idle timeout
  // without a real wall-clock wait.
  await page.clock.install()

  // Deliberately avoid the substring "Stop" in the fixture name -- once the
  // active entry's calendar chip renders the task name, its accessible name
  // would ambiguously match getByRole('button', { name: 'Stop' }) in later
  // specs sharing this Playwright run (see PROJECT_STATUS.md's documented
  // fixture-naming gotcha, e.g. "Timer cancel" -> "Timer abort").
  const taskName = `Idle timeout ${Date.now()}`

  await page.goto('/')
  const neutralHref = await faviconHref(page)
  await page.getByTitle('New task').click()
  await page.getByLabel('Name', { exact: true }).fill(taskName)
  await page.getByLabel('Definition of done').fill('done')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('task-tree').getByText(taskName)).toBeVisible()

  await page.getByRole('button', { name: 'Configuration' }).click()
  await page.getByRole('checkbox', { name: 'Stop tracking after inactivity' }).check()
  const timeoutInput = page.getByTestId('idle-timeout-input')
  await timeoutInput.fill('1')
  await timeoutInput.blur()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Execute' }).click()
  await page.getByTestId('task-picker-trigger').click()
  await page.getByTestId('task-picker-options').getByRole('button', { name: taskName, exact: true }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Tracking')).toBeVisible()

  // Green, with live elapsed-time digits, while tracking.
  await expect.poll(() => faviconHref(page)).toMatch(/^data:image\/png/)
  const trackingHref = await faviconHref(page)

  // No further real user interaction from here -- fast-forward the virtual
  // clock past the 1-minute idle timeout with nothing resetting it.
  await page.clock.fastForward(61_000)

  const idleMessage = new RegExp(`Timer for "${taskName}" was stopped automatically`)
  await expect(page.getByText(idleMessage)).toBeVisible()
  await expect(page.getByText('Tracking')).not.toBeVisible()

  // Red the instant idle-detection auto-stops the timer -- a different
  // image than the green tracking one (different color/no digits).
  const stoppedHref = await faviconHref(page)
  expect(stoppedHref).toMatch(/^data:image\/png/)
  expect(stoppedHref).not.toBe(trackingHref)

  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText(idleMessage)).not.toBeVisible()

  // Dismissing the acknowledgement dialog is the only thing that reverts
  // the favicon back to neutral.
  await expect.poll(() => faviconHref(page)).toBe(neutralHref)

  // The task was stopped without being marked done -- still selectable.
  await page.getByTestId('task-picker-trigger').click()
  await expect(
    page.getByTestId('task-picker-options').getByRole('button', { name: taskName, exact: true }),
  ).toBeVisible()
})
