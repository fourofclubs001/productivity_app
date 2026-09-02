import { useState } from 'react'
import { format } from 'date-fns'
import type { Task } from '../../types'
import { useCreateInterval } from '../../api/intervals'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
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
      { task_id: selectedTaskId, start: range.start.toISOString(), end: range.end.toISOString() },
      {
        onSuccess: onScheduled,
        onError: (error) => setErrorMessage((error as Error).message),
      },
    )
  }

  return (
    <Dialog
      onClose={onClose}
      title="Schedule existing task"
      subtitle={`${format(range.start, 'EEEE, MMM d, HH:mm')} – ${format(range.end, 'HH:mm')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!selectedTaskId || createInterval.isPending}>
            Schedule
          </Button>
        </>
      }
    >
      <TaskPicker tasks={tasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} />
      {errorMessage && <p className="mt-2 text-xs text-danger">{errorMessage}</p>}
    </Dialog>
  )
}
