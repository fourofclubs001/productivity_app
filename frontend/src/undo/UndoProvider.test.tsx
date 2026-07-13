import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UndoProvider, useUndo } from './UndoProvider'

function TestHarness({ onUndo }: { onUndo: () => void }) {
  const { pushUndo } = useUndo()
  return (
    <div>
      <button type="button" onClick={() => pushUndo({ label: 'test', undo: onUndo })}>
        Do something undoable
      </button>
      <input aria-label="text field" />
    </div>
  )
}

function TwoEntryHarness({ first, second }: { first: () => void; second: () => void }) {
  const { pushUndo } = useUndo()
  return (
    <div>
      <button type="button" onClick={() => pushUndo({ label: 'first', undo: first })}>
        Push first
      </button>
      <button type="button" onClick={() => pushUndo({ label: 'second', undo: second })}>
        Push second
      </button>
    </div>
  )
}

describe('UndoProvider', () => {
  it('throws when useUndo is called outside a provider', () => {
    const BadComponent = () => {
      useUndo()
      return null
    }
    expect(() => render(<BadComponent />)).toThrow(/UndoProvider/)
  })

  it('runs the most recently pushed undo entry on ctrl+z', () => {
    const onUndo = vi.fn()
    render(
      <UndoProvider>
        <TestHarness onUndo={onUndo} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do something undoable'))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('pops entries in LIFO order and does nothing once the stack is empty', () => {
    const first = vi.fn()
    const second = vi.fn()
    render(
      <UndoProvider>
        <TwoEntryHarness first={first} second={second} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Push first'))
    fireEvent.click(screen.getByText('Push second'))

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(first).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true }) // stack empty, no-op
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('does not intercept ctrl+z while focus is inside a text field', () => {
    const onUndo = vi.fn()
    render(
      <UndoProvider>
        <TestHarness onUndo={onUndo} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do something undoable'))
    const input = screen.getByLabelText('text field')
    input.focus()
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true })

    expect(onUndo).not.toHaveBeenCalled()
  })
})
