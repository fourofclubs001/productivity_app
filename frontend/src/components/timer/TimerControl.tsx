import { useEffect, useMemo, useState } from 'react'
import type { Task } from '../../types'
import { useActiveTimer, useStartTimer, useStopTimer } from '../../api/timer'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

export default function TimerControl({ tasks }: { tasks: Task[] }) {
  const { data: active } = useActiveTimer()
  const startTimer = useStartTimer()
  const stopTimer = useStopTimer()
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [choosingOutcome, setChoosingOutcome] = useState(false)

  const schedulableTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.is_leaf && task.state !== 'done')
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

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-4 border-b border-neutral-800 p-4">
        <span className="text-sm text-neutral-300">
          Tracking <strong>{activeTask?.name ?? active.task_id}</strong>
        </span>
        <span className="font-mono text-lg text-neutral-100">{formatElapsed(elapsedMs)}</span>
        {!choosingOutcome ? (
          <button
            type="button"
            onClick={() => setChoosingOutcome(true)}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
          >
            Stop
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Mark as done?</span>
            <button
              type="button"
              onClick={() => {
                stopTimer.mutate(true)
                setChoosingOutcome(false)
              }}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Yes, done
            </button>
            <button
              type="button"
              onClick={() => {
                stopTimer.mutate(false)
                setChoosingOutcome(false)
              }}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              No, keep in progress
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 p-4">
      <select
        value={selectedTaskId}
        onChange={(event) => setSelectedTaskId(event.target.value)}
        className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
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
        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        Start
      </button>
      {schedulableTasks.length === 0 && (
        <span className="text-xs text-neutral-600">No tasks available to track</span>
      )}
    </div>
  )
}
