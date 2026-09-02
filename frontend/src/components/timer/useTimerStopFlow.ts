import { useState } from 'react'
import { useMarkDone, useRevertDone, useStopTimer } from '../../api/timer'
import { makeRevertDoneEntry } from '../../lib/taskDoneUndoEntries'
import { useUndo } from '../../undo/UndoProvider'

interface StopTarget {
  taskId: string
  taskName: string
  definitionOfDone: string
}

// The 3-option stop-confirm flow (Yes-mark-done / No-just-stop / Cancel),
// shared by the nav readout and the detail-panel timer button. Clicking a
// Stop button opens the confirm dialog *before* stopping anything (M41).
export function useTimerStopFlow() {
  const stopTimer = useStopTimer()
  const markDone = useMarkDone()
  const revertDone = useRevertDone()
  const { pushUndo } = useUndo()
  const [confirming, setConfirming] = useState<StopTarget | null>(null)

  const doneMutators = {
    markDoneAsync: markDone.mutateAsync,
    revertDoneAsync: revertDone.mutateAsync,
  }

  return {
    confirming,
    request: (target: StopTarget) => setConfirming(target),
    cancel: () => setConfirming(null),
    isPending: stopTimer.isPending || markDone.isPending,
    stopOnly: () => stopTimer.mutate(undefined, { onSuccess: () => setConfirming(null) }),
    markDoneAndStop: () => {
      const taskId = confirming?.taskId
      if (!taskId) return
      stopTimer.mutate(undefined, {
        onSuccess: () => {
          markDone.mutate(taskId, {
            onSuccess: () => {
              pushUndo(makeRevertDoneEntry(taskId, doneMutators))
              setConfirming(null)
            },
          })
        },
      })
    },
  }
}
