import { useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UndoProvider, useUndo, type UndoEntry } from './UndoProvider'
import type { ViewKey } from '../lib/views'

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

function TestHarness({
  onUndo,
  onRedo,
  views = ['plan'],
}: {
  onUndo: () => void
  onRedo?: () => void
  views?: ViewKey[]
}) {
  const { pushUndo } = useUndo()
  const noopRedo: UndoEntry = {
    label: 'redo',
    views,
    run: () => {
      onRedo?.()
      return noopRedo
    },
  }
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          pushUndo({
            label: 'test',
            views,
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
  const noopRedo: UndoEntry = { label: 'redo', views: ['plan'], run: () => noopRedo }
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          pushUndo({
            label: 'first',
            views: ['plan'],
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
            views: ['plan'],
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
      views: ['plan'],
      run: () => {
        onLog(`delete ${id}`)
        return createEntry()
      },
    }
  }

  function createEntry(): UndoEntry {
    return {
      label: 'create',
      views: ['plan'],
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

/** Pushes one entry per view, tagged with the view named on its own button,
 * so a test can assert which entries survive an undo scoped to a given
 * view without needing to swap `activeView` mid-test. */
function MultiViewHarness({ onLog }: { onLog: (message: string) => void }) {
  const { pushUndo } = useUndo()
  function makeEntry(label: string, views: ViewKey[]): UndoEntry {
    return {
      label,
      views,
      run: () => {
        onLog(`undo ${label}`)
        return makeEntry(label, views)
      },
    }
  }
  function push(label: string, views: ViewKey[]) {
    pushUndo(makeEntry(label, views))
  }
  return (
    <div>
      <button type="button" onClick={() => push('plan-action', ['plan'])}>
        Push plan action
      </button>
      <button type="button" onClick={() => push('execute-action', ['execute'])}>
        Push execute action
      </button>
      <button type="button" onClick={() => push('cross-action', ['plan', 'execute'])}>
        Push cross-view action
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

  it('runs the most recently pushed undo entry on ctrl+z', async () => {
    const onUndo = vi.fn()
    render(
      <UndoProvider activeView="plan">
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
      <UndoProvider activeView="plan">
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
      <UndoProvider activeView="plan">
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
      <UndoProvider activeView="plan">
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
      <UndoProvider activeView="plan">
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
      <UndoProvider activeView="plan">
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

  it('a fresh undoable action clears the redo stack for its own view', async () => {
    const log: string[] = []
    render(
      <UndoProvider activeView="plan">
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

  describe('per-view scoping (v03 item 8)', () => {
    it('ctrl+z on a view only pops that view\'s entries, leaving others in place', async () => {
      const log: string[] = []
      const { rerender } = render(
        <UndoProvider activeView="plan">
          <MultiViewHarness onLog={(m) => log.push(m)} />
        </UndoProvider>,
      )

      fireEvent.click(screen.getByText('Push plan action'))
      fireEvent.click(screen.getByText('Push execute action'))

      // On Plan, ctrl+z should skip over the top "execute-action" entry and
      // pop "plan-action" instead -- not discarding the skipped entry.
      await pressUndo()
      expect(log).toEqual(['undo plan-action'])

      // Switch to Execute: its entry is still there, untouched by the above.
      rerender(
        <UndoProvider activeView="execute">
          <MultiViewHarness onLog={(m) => log.push(m)} />
        </UndoProvider>,
      )
      await pressUndo()
      expect(log).toEqual(['undo plan-action', 'undo execute-action'])
    })

    it('a cross-view entry is poppable from either of its tagged views', async () => {
      const log: string[] = []
      render(
        <UndoProvider activeView="execute">
          <MultiViewHarness onLog={(m) => log.push(m)} />
        </UndoProvider>,
      )

      fireEvent.click(screen.getByText('Push cross-view action'))
      await pressUndo()

      expect(log).toEqual(['undo cross-action'])
    })

    it('ctrl+z on a view with no matching entries is a no-op', async () => {
      const log: string[] = []
      render(
        <UndoProvider activeView="evaluate">
          <MultiViewHarness onLog={(m) => log.push(m)} />
        </UndoProvider>,
      )

      fireEvent.click(screen.getByText('Push plan action'))
      fireEvent.click(screen.getByText('Push execute action'))
      await pressUndo()

      expect(log).toEqual([])
    })

    it('pushing a new Plan action does not clear Execute\'s pending redo', async () => {
      const onExecuteUndo = vi.fn()
      const onExecuteRedo = vi.fn()
      const onPlanUndo = vi.fn()
      const { rerender } = render(
        <UndoProvider activeView="execute">
          <TestHarness onUndo={onExecuteUndo} onRedo={onExecuteRedo} views={['execute']} />
        </UndoProvider>,
      )

      fireEvent.click(screen.getByText('Do something undoable'))
      await pressUndo() // Execute now has a pending redo entry

      rerender(
        <UndoProvider activeView="plan">
          <TestHarness onUndo={onPlanUndo} views={['plan']} />
        </UndoProvider>,
      )
      fireEvent.click(screen.getByText('Do something undoable'))
      await pressUndo() // Plan's own action, unrelated to Execute's redo entry

      rerender(
        <UndoProvider activeView="execute">
          <TestHarness onUndo={onExecuteUndo} onRedo={onExecuteRedo} views={['execute']} />
        </UndoProvider>,
      )
      await pressRedo()

      // Execute's redo entry survived the unrelated Plan push/undo above.
      expect(onExecuteRedo).toHaveBeenCalledTimes(1)
    })
  })
})
