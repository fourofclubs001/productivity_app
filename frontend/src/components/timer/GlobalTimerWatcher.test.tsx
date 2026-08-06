import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GlobalTimerWatcher from './GlobalTimerWatcher'

const activeTimerMock = vi.fn()

vi.mock('../../api/timer', () => ({
  useActiveTimer: () => activeTimerMock(),
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
  applyFaviconMock.mockClear()
  document.title = 'Productivity App'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GlobalTimerWatcher favicon wiring', () => {
  it('is neutral when nothing is tracked', () => {
    activeTimerMock.mockReturnValue({ data: null })
    render(<GlobalTimerWatcher />)

    expect(applyFaviconMock).toHaveBeenCalledWith('neutral')
  })

  it('goes green while tracking', () => {
    mockActive()
    render(<GlobalTimerWatcher />)

    expect(applyFaviconMock).toHaveBeenCalledWith('green')
  })

  it('a manual stop reverts straight back to neutral', () => {
    mockActive()
    const { rerender } = render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    applyFaviconMock.mockClear()

    activeTimerMock.mockReturnValue({ data: null })
    rerender(<GlobalTimerWatcher />)

    expect(applyFaviconMock).toHaveBeenCalledWith('neutral')
  })
})

describe('GlobalTimerWatcher tab title wiring', () => {
  it('keeps the static title when nothing is tracked', () => {
    activeTimerMock.mockReturnValue({ data: null })
    render(<GlobalTimerWatcher />)

    expect(document.title).toBe('Productivity App')
  })

  it('shows the live elapsed mm:ss ahead of the app name while tracking', () => {
    mockActive()
    render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(65_000)
    })

    expect(document.title).toBe('01:05 · Productivity App')
  })

  it('reverts the title to just the app name once tracking stops', () => {
    mockActive()
    const { rerender } = render(<GlobalTimerWatcher />)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(document.title).not.toBe('Productivity App')

    activeTimerMock.mockReturnValue({ data: null })
    rerender(<GlobalTimerWatcher />)

    expect(document.title).toBe('Productivity App')
  })
})
