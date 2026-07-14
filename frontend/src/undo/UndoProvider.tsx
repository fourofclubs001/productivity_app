import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'

export interface UndoEntry {
  label: string
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

export function UndoProvider({ children }: { children: ReactNode }) {
  const undoStackRef = useRef<UndoEntry[]>([])
  const redoStackRef = useRef<UndoEntry[]>([])

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry)
    // A fresh action invalidates whatever could previously be redone.
    redoStackRef.current = []
  }, [])

  useEffect(() => {
    async function performUndo() {
      const entry = undoStackRef.current.pop()
      if (!entry) return
      const redoEntry = await entry.run()
      redoStackRef.current.push(redoEntry)
    }

    async function performRedo() {
      const entry = redoStackRef.current.pop()
      if (!entry) return
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
