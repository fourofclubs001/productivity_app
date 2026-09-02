import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ViewKey } from '../lib/views'

export interface UndoEntry {
  label: string
  /** Which view(s) this entry belongs to -- Ctrl+Z on a given view only
   * pops/undoes entries tagged with that view (v03 item 8). Normally just
   * the view that pushed it; a cross-view side-effect entry is tagged with
   * every view it touches. */
  views: ViewKey[]
  /** Performs the action and returns the entry that reverses it -- a
   * recursive shape so undo/redo stays correct across repeated cycles even
   * when actions recreate rows with server-generated ids. */
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

function findLastIndexForView(stack: UndoEntry[], view: ViewKey): number {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].views.includes(view)) return i
  }
  return -1
}

interface ToastState {
  id: number
  label: string
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
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    activeViewRef.current = activeView
  }, [activeView])

  const performUndo = useCallback(async () => {
    const view = activeViewRef.current
    const index = findLastIndexForView(undoStackRef.current, view)
    if (index === -1) return
    const [entry] = undoStackRef.current.splice(index, 1)
    const redoEntry = await entry.run()
    redoStackRef.current.push(redoEntry)
  }, [])

  const performRedo = useCallback(async () => {
    const view = activeViewRef.current
    const index = findLastIndexForView(redoStackRef.current, view)
    if (index === -1) return
    const [entry] = redoStackRef.current.splice(index, 1)
    const undoEntry = await entry.run()
    undoStackRef.current.push(undoEntry)
  }, [])

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry)
    redoStackRef.current = redoStackRef.current.filter(
      (redoEntry) => !redoEntry.views.some((view) => entry.views.includes(view)),
    )
    setToast({ id: Date.now(), label: entry.label })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return
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
  }, [performUndo, performRedo])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  return (
    <UndoContext.Provider value={{ pushUndo }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed bottom-4 left-4 z-[60] flex items-center gap-4 rounded-sm bg-text-primary px-4 py-2.5 text-sm text-white shadow-2 [animation:fade-in_150ms_ease-out]"
        >
          <span>{toast.label}</span>
          <button
            type="button"
            className="font-medium text-[#8ab4f8] hover:text-white"
            onClick={() => {
              setToast(null)
              void performUndo()
            }}
          >
            Undo
          </button>
        </div>
      )}
    </UndoContext.Provider>
  )
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext)
  if (!ctx) throw new Error('useUndo must be used within an UndoProvider')
  return ctx
}
