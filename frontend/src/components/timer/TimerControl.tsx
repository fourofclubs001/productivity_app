import { useEffect, useMemo, useState } from 'react'
import type { Task } from '../../types'
import { useActiveTimer, useMarkDone, useStartTimer, useStopTimer } from '../../api/timer'

const UNTRACKABLE_STATES = new Set(['sprint_done', 'done'])

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

interface JustStopped {
  taskId: string
  taskName: string
  elapsedMs: number
}

export default function TimerControl({ tasks }: { tasks: Task[] }) {
  const { data: active } = useActiveTimer()
  const startTimer = useStartTimer()
  const stopTimer = useStopTimer()
  const markDone = useMarkDone()
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [justStopped, setJustStopped] = useState<JustStopped | null>(null)

  const schedulableTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.is_leaf && !UNTRACKABLE_STATES.has(task.state))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tasks],
  )

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

  function handleStop() {
    if (!active) return
    const taskId = active.task_id
    const taskName = activeTask?.name ?? taskId
    const frozenElapsedMs = elapsedMs
    stopTimer.mutate(undefined, {
      onSuccess: () => setJustStopped({ taskId, taskName, elapsedMs: frozenElapsedMs }),
    })
  }

  if (justStopped) {
    return (
      <div className="flex flex-wrap items-center gap-4 border-b border-border p-4">
        <span className="text-sm text-text-secondary">
          Stopped <strong className="text-text-primary">{justStopped.taskName}</strong>
        </span>
        <span className="font-mono text-lg text-text-primary">
          {formatElapsed(justStopped.elapsedMs)}
        </span>
        <span className="text-xs text-text-secondary">Mark as done?</span>
        <button
          type="button"
          onClick={() => markDone.mutate(justStopped.taskId, { onSuccess: () => setJustStopped(null) })}
          className="rounded bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success-hover"
        >
          Yes, done
        </button>
        <button
          type="button"
          onClick={() => setJustStopped(null)}
          className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover"
        >
          No, keep in progress
        </button>
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
      <select
        value={selectedTaskId}
        onChange={(event) => setSelectedTaskId(event.target.value)}
        className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
      >
        <option value="">Select a task…</option>
        {schedulableTasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selectedTaskId || startTimer.isPending}
        onClick={() => startTimer.mutate(selectedTaskId)}
        className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        Start
      </button>
      {schedulableTasks.length === 0 && (
        <span className="text-xs text-text-secondary">No tasks available to track</span>
      )}
    </div>
  )
}
