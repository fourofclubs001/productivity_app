import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'

export interface UndoEntry {
  label: string
  undo: () => Promise<unknown> | void
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
  const stackRef = useRef<UndoEntry[]>([])

  const pushUndo = useCallback((entry: UndoEntry) => {
    stackRef.current.push(entry)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isUndoShortcut =
        (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
      if (!isUndoShortcut) return
      // Let native undo (e.g. undoing typed characters) win inside text fields --
      // only intercept ctrl+z for app-level actions everywhere else.
      if (isEditableTarget(event.target)) return

      const entry = stackRef.current.pop()
      if (!entry) return
      event.preventDefault()
      void entry.undo()
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
