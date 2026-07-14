import { useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UndoProvider, useUndo, type UndoEntry } from './UndoProvider'

// The keydown handler's undo/redo work is async (an entry's run() is
// awaited even when it resolves synchronously, since `await` always defers
// at least one microtask). Wrap each shortcut dispatch so that microtask
// has actually settled before the next assertion/dispatch runs.
async function pressUndo(target: Window | Element = window) {
  await act(async () => {
    fireEvent.keyDown(target, { key: 'z', ctrlKey: true })
    await Promise.resolve()
  })
}

async function pressRedo(shiftInstead = false) {
  await act(async () => {
    if (shiftInstead) {
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
    } else {
      fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    }
    await Promise.resolve()
  })
}

function TestHarness({ onUndo }: { onUndo: () => void }) {
  const { pushUndo } = useUndo()
  const noopRedo: UndoEntry = { label: 'redo', run: () => noopRedo }
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          pushUndo({
            label: 'test',
            run: () => {
              onUndo()
              return noopRedo
            },
          })
        }
      >
        Do something undoable
      </button>
      <input aria-label="text field" />
    </div>
  )
}

function TwoEntryHarness({ first, second }: { first: () => void; second: () => void }) {
  const { pushUndo } = useUndo()
  const noopRedo: UndoEntry = { label: 'redo', run: () => noopRedo }
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          pushUndo({
            label: 'first',
            run: () => {
              first()
              return noopRedo
            },
          })
        }
      >
        Push first
      </button>
      <button
        type="button"
        onClick={() =>
          pushUndo({
            label: 'second',
            run: () => {
              second()
              return noopRedo
            },
          })
        }
      >
        Push second
      </button>
    </div>
  )
}

/** Mimics the real create/delete-interval undo pair: each undo/redo cycle
 * "recreates" the resource under a fresh id, so repeated undo/redo must
 * keep tracking the *current* id rather than the one captured at push time. */
function ChurningHarness({ onLog }: { onLog: (message: string) => void }) {
  const { pushUndo } = useUndo()
  const nextId = useRef(1)

  function deleteEntry(id: number): UndoEntry {
    return {
      label: `delete ${id}`,
      run: () => {
        onLog(`delete ${id}`)
        return createEntry()
      },
    }
  }

  function createEntry(): UndoEntry {
    return {
      label: 'create',
      run: () => {
        const id = nextId.current++
        onLog(`create ${id}`)
        return deleteEntry(id)
      },
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        const id = nextId.current++
        onLog(`create ${id}`)
        pushUndo(deleteEntry(id))
      }}
    >
      Do churning action
    </button>
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

  it('runs the most recently pushed undo entry on ctrl+z', async () => {
    const onUndo = vi.fn()
    render(
      <UndoProvider>
        <TestHarness onUndo={onUndo} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do something undoable'))
    await pressUndo()

    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('pops entries in LIFO order and does nothing once the stack is empty', async () => {
    const first = vi.fn()
    const second = vi.fn()
    render(
      <UndoProvider>
        <TwoEntryHarness first={first} second={second} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Push first'))
    fireEvent.click(screen.getByText('Push second'))

    await pressUndo()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()

    await pressUndo()
    expect(first).toHaveBeenCalledTimes(1)

    await pressUndo() // stack empty, no-op
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('does not intercept ctrl+z while focus is inside a text field', async () => {
    const onUndo = vi.fn()
    render(
      <UndoProvider>
        <TestHarness onUndo={onUndo} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do something undoable'))
    const input = screen.getByLabelText('text field')
    input.focus()
    await pressUndo(input)

    expect(onUndo).not.toHaveBeenCalled()
  })

  it('ctrl+y redoes what ctrl+z undid', async () => {
    const log: string[] = []
    render(
      <UndoProvider>
        <ChurningHarness onLog={(m) => log.push(m)} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do churning action'))
    expect(log).toEqual(['create 1'])

    await pressUndo()
    expect(log).toEqual(['create 1', 'delete 1'])

    await pressRedo()
    expect(log).toEqual(['create 1', 'delete 1', 'create 2'])
  })

  it('ctrl+shift+z also redoes', async () => {
    const log: string[] = []
    render(
      <UndoProvider>
        <ChurningHarness onLog={(m) => log.push(m)} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do churning action'))
    await pressUndo()
    await pressRedo(true)

    expect(log).toEqual(['create 1', 'delete 1', 'create 2'])
  })

  it('stays correct across repeated undo/redo cycles as the resource id churns', async () => {
    const log: string[] = []
    render(
      <UndoProvider>
        <ChurningHarness onLog={(m) => log.push(m)} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do churning action')) // create 1
    await pressUndo() // delete 1
    await pressRedo() // create 2
    await pressUndo() // delete 2 (not 1!)
    await pressRedo() // create 3

    expect(log).toEqual(['create 1', 'delete 1', 'create 2', 'delete 2', 'create 3'])
  })

  it('a fresh undoable action clears the redo stack', async () => {
    const log: string[] = []
    render(
      <UndoProvider>
        <ChurningHarness onLog={(m) => log.push(m)} />
      </UndoProvider>,
    )

    fireEvent.click(screen.getByText('Do churning action')) // create 1
    await pressUndo() // delete 1 -- redo stack now has a "create 2" entry

    fireEvent.click(screen.getByText('Do churning action')) // create 2, and this should clear the redo stack
    log.length = 0

    await pressRedo() // nothing to redo
    expect(log).toEqual([])
  })
})
