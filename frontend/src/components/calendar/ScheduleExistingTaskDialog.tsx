import { useState } from 'react'
import { format } from 'date-fns'
import type { Task } from '../../types'
import { useCreateInterval } from '../../api/intervals'
import TaskPicker from '../timer/TaskPicker'

/** Schedules an already-existing task into a Plan-calendar drag-selected
 * time range (v05 item 9). The range is already fixed by the drag, so this
 * bypasses AddToCalendarModal's own time-picking UI entirely -- just a task
 * picker and a confirm button.
 */
export default function ScheduleExistingTaskDialog({
  tasks,
  range,
  onClose,
  onScheduled,
}: {
  tasks: Task[]
  range: { start: Date; end: Date }
  onClose: () => void
  onScheduled: () => void
}) {
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const createInterval = useCreateInterval()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleSchedule() {
    if (!selectedTaskId) return
    setErrorMessage(null)
    createInterval.mutate(
      {
        task_id: selectedTaskId,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      {
        onSuccess: onScheduled,
        onError: (error) => setErrorMessage((error as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Schedule existing task</h2>
        <p className="mb-3 text-xs text-text-secondary">
          {format(range.start, 'EEEE, MMM d, HH:mm')} – {format(range.end, 'HH:mm')}
        </p>
        <TaskPicker tasks={tasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={!selectedTaskId || createInterval.isPending}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
        {errorMessage && <p className="mt-2 text-xs text-danger">{errorMessage}</p>}
      </div>
    </div>
  )
}
