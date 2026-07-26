import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GlobalTimerWatcher from './GlobalTimerWatcher'
import { setIdleDetectionSettings } from '../../lib/idleDetectionSettings'

const activeTimerMock = vi.fn()
// Mirrors the real app: a successful stop invalidates/refetches the active-
// timer query, which flips `active` to null -- without this, the mock would
// leave `active` truthy forever, unlike production behavior.
const stopMutate = vi.fn((_vars?: unknown, options?: { onSuccess?: () => void }) => {
  activeTimerMock.mockReturnValue({ data: null })
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

const applyFaviconMock = vi.fn()
vi.mock('../../lib/favicon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/favicon')>()
  return { ...actual, applyFavicon: (...args: Parameters<typeof actual.applyFavicon>) => applyFaviconMock(...args) }
})

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
  applyFaviconMock.mockClear()
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

describe('GlobalTimerWatcher favicon wiring', () => {
  it('is neutral when nothing is tracked', () => {
    activeTimerMock.mockReturnValue({ data: null })
    render(<GlobalTimerWatcher />)

    expect(applyFaviconMock).toHaveBeenCalledWith('neutral', 0)
  })

  it('goes green with the live elapsed time while tracking', () => {
    mockActive()
    render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(applyFaviconMock.mock.calls.some(([state, ms]) => state === 'green' && ms >= 5_000)).toBe(true)
  })

  it('goes red once idle-detection auto-stops the timer, back to neutral on dismissal', () => {
    setIdleDetectionSettings({ enabled: true, timeoutMinutes: 1 })
    mockActive()
    render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(applyFaviconMock).toHaveBeenLastCalledWith('red', expect.any(Number))

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(applyFaviconMock).toHaveBeenLastCalledWith('neutral', expect.any(Number))
  })

  it('a normal manual stop goes straight to neutral, never through red', () => {
    mockActive()
    const { rerender } = render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    applyFaviconMock.mockClear()

    activeTimerMock.mockReturnValue({ data: null })
    rerender(<GlobalTimerWatcher />)

    expect(applyFaviconMock).not.toHaveBeenCalledWith('red', expect.anything())
    expect(applyFaviconMock).toHaveBeenCalledWith('neutral', 0)
  })
})
