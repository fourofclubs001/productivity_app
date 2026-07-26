import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import ConfigDialog from './ConfigDialog'
import { setIdleDetectionSettings } from '../../lib/idleDetectionSettings'

beforeEach(() => {
  window.localStorage.clear()
  setIdleDetectionSettings({ enabled: false, timeoutMinutes: 10 })
})

describe('ConfigDialog', () => {
  it('toggles the idle-detection setting', () => {
    render(<ConfigDialog onClose={() => {}} />)

    const checkbox = screen.getByRole('checkbox', { name: /Stop tracking after inactivity/ })
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(setIdleDetectionSettingsWasCalled()).toBe(true)
  })

  it('allows clearing and retyping the timeout field without it snapping back mid-edit', () => {
    render(<ConfigDialog onClose={() => {}} />)

    const input = screen.getByDisplayValue('10')
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue(null)

    fireEvent.change(input, { target: { value: '25' } })
    fireEvent.blur(input)
    expect(input).toHaveValue(25)
  })

  it('coerces an invalid blur value back to a valid positive integer', () => {
    render(<ConfigDialog onClose={() => {}} />)

    const input = screen.getByDisplayValue('10')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(input).toHaveValue(1)
  })

  it('calls onClose when Close is clicked', () => {
    let closed = false
    render(<ConfigDialog onClose={() => (closed = true)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(closed).toBe(true)
  })
})

function setIdleDetectionSettingsWasCalled() {
  return JSON.parse(window.localStorage.getItem('idle-detection-settings')!).enabled === true
}
