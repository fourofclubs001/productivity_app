import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'
import type { ViewKey } from '../lib/views'

export interface UndoEntry {
  label: string
  /** Which view(s) this entry belongs to -- Ctrl+Z on a given view only
   * pops/undoes entries tagged with that view (v03 item 8). Normally just
   * the view that pushed it; a cross-view side-effect entry (e.g. marking
   * a task done from Execute, which also changes Plan's displayed state)
   * is tagged with every view it touches. */
  views: ViewKey[]
  /** Performs the action and returns the entry that reverses it -- e.g. an
   * undo entry's run() re-creates a deleted row and returns a redo entry
   * whose own run() deletes that (newly-recreated, differently-id'd) row
   * again. This recursive shape is what lets undo/redo stay correct across
   * repeated cycles even when actions recreate rows with server-generated
   * ids, unlike a single static inverse closure would. */
  run: () => Promise<UndoEntry> | UndoEntry
}

interface UndoContextValue {
  pushUndo: (entry: UndoEntry) => void
}

const UndoContext = createContext<UndoContextValue | null>(null)

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/** Finds the index of the last entry tagged with `view`, without discarding
 * (or reordering) anything above it -- an entry from another view that gets
 * skipped over stays exactly where it was, still poppable once that view
 * becomes active again. */
function findLastIndexForView(stack: UndoEntry[], view: ViewKey): number {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].views.includes(view)) return i
  }
  return -1
}

export function UndoProvider({
  children,
  activeView,
}: {
  children: ReactNode
  activeView: ViewKey
}) {
  const undoStackRef = useRef<UndoEntry[]>([])
  const redoStackRef = useRef<UndoEntry[]>([])
  const activeViewRef = useRef(activeView)

  useEffect(() => {
    activeViewRef.current = activeView
  }, [activeView])

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry)
    // A fresh action invalidates whatever could previously be redone for
    // the view(s) it belongs to -- other views' redo history is untouched.
    redoStackRef.current = redoStackRef.current.filter(
      (redoEntry) => !redoEntry.views.some((view) => entry.views.includes(view)),
    )
  }, [])

  useEffect(() => {
    async function performUndo() {
      const view = activeViewRef.current
      const index = findLastIndexForView(undoStackRef.current, view)
      if (index === -1) return
      const [entry] = undoStackRef.current.splice(index, 1)
      const redoEntry = await entry.run()
      redoStackRef.current.push(redoEntry)
    }

    async function performRedo() {
      const view = activeViewRef.current
      const index = findLastIndexForView(redoStackRef.current, view)
      if (index === -1) return
      const [entry] = redoStackRef.current.splice(index, 1)
      const undoEntry = await entry.run()
      undoStackRef.current.push(undoEntry)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return
      // Let native undo/redo (e.g. undoing typed characters) win inside
      // text fields -- only intercept these shortcuts everywhere else.
      if (isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        void performUndo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        void performRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <UndoContext.Provider value={{ pushUndo }}>{children}</UndoContext.Provider>
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext)
  if (!ctx) throw new Error('useUndo must be used within an UndoProvider')
  return ctx
}
