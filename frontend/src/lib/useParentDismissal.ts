import { useCallback, useEffect, useState } from 'react'

export type ParentDecision = 'hidden' | 'kept'

const STORAGE_KEY = 'plan.parentDecisions'

function readStored(): Record<string, ParentDecision> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Tracks, per parent task, whether the user has already been asked "all its
 * sub-tasks are done, remove it from Plan too?" and how they answered --
 * persisted so the prompt doesn't reappear on every reload. 'hidden' means
 * the parent itself is also hidden from the Plan tree now (undo-able);
 * 'kept' means the user said no and the row should render normally even
 * though it still qualifies for the prompt.
 */
export function useParentDismissal() {
  const [decisions, setDecisions] = useState<Record<string, ParentDecision>>(readStored)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions))
  }, [decisions])

  const decide = useCallback((taskId: string, decision: ParentDecision) => {
    setDecisions((prev) => ({ ...prev, [taskId]: decision }))
  }, [])

  const undecide = useCallback((taskId: string) => {
    setDecisions((prev) => {
      if (!(taskId in prev)) return prev
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }, [])

  return { decisions, decide, undecide }
}
