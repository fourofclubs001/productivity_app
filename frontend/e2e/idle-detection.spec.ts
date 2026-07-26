import { test, expect } from '@playwright/test'

test('idle detection auto-stops the timer and shows an acknowledgement dialog', async ({ page }) => {
  // Virtualize time before any page script runs, per Playwright's clock
  // ordering requirement -- lets us fast-forward past the idle timeout
  // without a real wall-clock wait.
  await page.clock.install()

  const taskName = `Idle stop ${Date.now()}`

  await page.goto('/')
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

  // No further real user interaction from here -- fast-forward the virtual
  // clock past the 1-minute idle timeout with nothing resetting it.
  await page.clock.fastForward(61_000)

  const idleMessage = new RegExp(`Timer for "${taskName}" was stopped automatically`)
  await expect(page.getByText(idleMessage)).toBeVisible()
  await expect(page.getByText('Tracking')).not.toBeVisible()

  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText(idleMessage)).not.toBeVisible()

  // The task was stopped without being marked done -- still selectable.
  await page.getByTestId('task-picker-trigger').click()
  await expect(
    page.getByTestId('task-picker-options').getByRole('button', { name: taskName, exact: true }),
  ).toBeVisible()
})
