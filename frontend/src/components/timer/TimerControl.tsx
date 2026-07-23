import { useEffect, useState } from 'react'
import type { Task } from '../../types'
import {
  useActiveTimer,
  useMarkDone,
  useRevertDone,
  useStartTimer,
  useStopTimer,
} from '../../api/timer'
import { makeRevertDoneEntry } from '../../lib/taskDoneUndoEntries'
import { useUndo } from '../../undo/UndoProvider'
import AlertDialog from '../common/AlertDialog'
import StopTimerConfirmModal from './StopTimerConfirmModal'
import TaskPicker from './TaskPicker'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

interface ConfirmingStop {
  taskId: string
  taskName: string
  definitionOfDone: string
  elapsedMs: number
}

export default function TimerControl({ tasks }: { tasks: Task[] }) {
  const { data: active } = useActiveTimer()
  const startTimer = useStartTimer()
  const stopTimer = useStopTimer()
  const markDone = useMarkDone()
  const revertDone = useRevertDone()
  const { pushUndo } = useUndo()
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [confirmingStop, setConfirmingStop] = useState<ConfirmingStop | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      setElapsedMs(0)
      return
    }
    const start = new Date(active.start).getTime()
    const update = () => setElapsedMs(Date.now() - start)
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [active])

  const activeTask = active ? tasks.find((task) => task.id === active.task_id) : undefined
  const doneMutators = { markDoneAsync: markDone.mutateAsync, revertDoneAsync: revertDone.mutateAsync }

  function handleStop() {
    if (!active) return
    setConfirmingStop({
      taskId: active.task_id,
      taskName: activeTask?.name ?? active.task_id,
      definitionOfDone: activeTask?.definition_of_done ?? '',
      elapsedMs,
    })
  }

  // Checked ahead of `active`: once Yes/No-stop-the-timer fires
  // `stopTimer.mutate`, the active-timer query gets invalidated and `active`
  // flips to null well before the follow-up `markDone` call (if any)
  // resolves -- keying this branch on `confirmingStop` instead keeps the
  // dialog (and a frozen elapsed reading) on screen for that whole window,
  // rather than having it vanish mid-flight when `active` disappears.
  if (confirmingStop) {
    return (
      <div className="flex flex-wrap items-center gap-4 border-b border-border p-4">
        <span className="text-sm text-text-secondary">
          {active ? 'Tracking' : 'Stopped'}{' '}
          <strong className="text-text-primary">{confirmingStop.taskName}</strong>
        </span>
        <span className="font-mono text-lg text-text-primary">
          {formatElapsed(active ? elapsedMs : confirmingStop.elapsedMs)}
        </span>
        <StopTimerConfirmModal
          taskName={confirmingStop.taskName}
          definitionOfDone={confirmingStop.definitionOfDone}
          isPending={stopTimer.isPending || markDone.isPending}
          onCancel={() => setConfirmingStop(null)}
          onStopOnly={() => {
            stopTimer.mutate(undefined, { onSuccess: () => setConfirmingStop(null) })
          }}
          onMarkDone={() => {
            const { taskId } = confirmingStop
            stopTimer.mutate(undefined, {
              onSuccess: () => {
                markDone.mutate(taskId, {
                  onSuccess: () => {
                    pushUndo(makeRevertDoneEntry(taskId, doneMutators))
                    setConfirmingStop(null)
                  },
                })
              },
            })
          }}
        />
      </div>
    )
  }

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-4 border-b border-border p-4">
        <span className="text-sm text-text-secondary">
          Tracking <strong className="text-text-primary">{activeTask?.name ?? active.task_id}</strong>
        </span>
        <span className="font-mono text-lg text-text-primary">{formatElapsed(elapsedMs)}</span>
        <button
          type="button"
          onClick={handleStop}
          disabled={stopTimer.isPending}
          className="rounded bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger-hover disabled:opacity-50"
        >
          Stop
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
      <TaskPicker tasks={tasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} />
      <button
        type="button"
        disabled={!selectedTaskId || startTimer.isPending}
        onClick={() =>
          startTimer.mutate(selectedTaskId, {
            onError: (error) => setAlertMessage((error as Error).message),
          })
        }
        className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        Start
      </button>
      {alertMessage && (
        <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </div>
  )
}
