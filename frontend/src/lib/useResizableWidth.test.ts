import { act, renderHook, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useResizableWidth } from './useResizableWidth'

describe('useResizableWidth', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts at the default width when nothing is stored', () => {
    const { result } = renderHook(() => useResizableWidth('test.width', 250, 100, 500))
    expect(result.current.width).toBe(250)
  })

  it('restores a previously persisted width, clamped to bounds', () => {
    window.localStorage.setItem('test.width', '9999')
    const { result } = renderHook(() => useResizableWidth('test.width', 250, 100, 500))
    expect(result.current.width).toBe(500)
  })

  it('updates width on drag and persists it, clamped to min/max', () => {
    const { result } = renderHook(() => useResizableWidth('test.width', 250, 100, 500))

    act(() => {
      result.current.startResize({
        preventDefault: () => {},
        clientX: 100,
      } as unknown as React.MouseEvent)
    })
    act(() => {
      fireEvent.mouseMove(window, { clientX: 150 })
    })
    act(() => {
      fireEvent.mouseUp(window)
    })

    expect(result.current.width).toBe(300)
    expect(window.localStorage.getItem('test.width')).toBe('300')
  })

  it('clamps drag movement to the min/max bounds', () => {
    const { result } = renderHook(() => useResizableWidth('test.width', 250, 100, 500))

    act(() => {
      result.current.startResize({
        preventDefault: () => {},
        clientX: 100,
      } as unknown as React.MouseEvent)
    })
    act(() => {
      fireEvent.mouseMove(window, { clientX: -1000 })
    })
    act(() => {
      fireEvent.mouseUp(window)
    })

    expect(result.current.width).toBe(100)
  })
})
