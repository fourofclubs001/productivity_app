import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GlobalTimerWatcher from './GlobalTimerWatcher'
import { setIdleDetectionSettings } from '../../lib/idleDetectionSettings'

const activeTimerMock = vi.fn()
const stopMutate = vi.fn((_vars?: unknown, options?: { onSuccess?: () => void }) => {
  options?.onSuccess?.()
})

vi.mock('../../api/timer', () => ({
  useActiveTimer: () => activeTimerMock(),
  useStopTimer: () => ({ mutate: stopMutate, isPending: false }),
}))

const playAlertToneMock = vi.fn()
vi.mock('../../lib/playAlertTone', () => ({
  playAlertTone: () => playAlertToneMock(),
}))

function mockActive() {
  activeTimerMock.mockReturnValue({
    data: { id: 'e1', task_id: 'leaf', task_name: 'Leaf task', start: new Date().toISOString(), end: null },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  activeTimerMock.mockReset()
  stopMutate.mockClear()
  playAlertToneMock.mockClear()
  setIdleDetectionSettings({ enabled: false, timeoutMinutes: 10 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GlobalTimerWatcher', () => {
  it('does nothing while the setting is disabled', () => {
    setIdleDetectionSettings({ enabled: false, timeoutMinutes: 1 })
    mockActive()
    render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })

    expect(stopMutate).not.toHaveBeenCalled()
  })

  it('auto-stops the timer and shows an acknowledgement dialog once idle for the configured duration', () => {
    setIdleDetectionSettings({ enabled: true, timeoutMinutes: 1 })
    mockActive()
    render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(playAlertToneMock).toHaveBeenCalled()
    expect(stopMutate).toHaveBeenCalledWith(undefined, expect.anything())
    expect(screen.getByText(/stopped automatically/)).toBeInTheDocument()
    expect(screen.getByText(/Leaf task/)).toBeInTheDocument()
  })

  it('activity resets the idle clock', () => {
    setIdleDetectionSettings({ enabled: true, timeoutMinutes: 1 })
    mockActive()
    render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(45_000)
      window.dispatchEvent(new Event('mousemove'))
      vi.advanceTimersByTime(45_000)
    })

    expect(stopMutate).not.toHaveBeenCalled()
  })

  it('dismissing the acknowledgement dialog clears the notice', () => {
    setIdleDetectionSettings({ enabled: true, timeoutMinutes: 1 })
    mockActive()
    render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByText(/stopped automatically/)).not.toBeInTheDocument()
  })
})
