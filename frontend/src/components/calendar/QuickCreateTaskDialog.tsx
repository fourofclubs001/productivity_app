import { useState } from 'react'
import { format } from 'date-fns'
import { useCreateTask } from '../../api/tasks'
import { useCreateInterval } from '../../api/intervals'
import Dialog from '../common/Dialog'
import Button from '../common/Button'

/** Creates a brand-new, non-recurring, root-level leaf task and schedules it
 * into a Plan-calendar drag-selected time range in one step (v05 item 9) --
 * two plain client-side calls (create task, then create interval), not a
 * new combined backend endpoint, since neither call has any real
 * server-side coupling to the other worth doing in one round-trip (unlike
 * routine creation's first-occurrence generation).
 */
export default function QuickCreateTaskDialog({
  range,
  onClose,
  onCreated,
}: {
  range: { start: Date; end: Date }
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const createTask = useCreateTask()
  const createInterval = useCreateInterval()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && definitionOfDone.trim().length > 0
  const isPending = createTask.isPending || createInterval.isPending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setErrorMessage(null)
    createTask.mutate(
      { name: name.trim(), definition_of_done: definitionOfDone.trim() },
      {
        onSuccess: (task) => {
          createInterval.mutate(
            { task_id: task.id, start: range.start.toISOString(), end: range.end.toISOString() },
            {
              onSuccess: onCreated,
              onError: (error) => setErrorMessage((error as Error).message),
            },
          )
        },
        onError: (error) => setErrorMessage((error as Error).message),
      },
    )
  }

  return (
    <Dialog
      onClose={onClose}
      onSubmit={handleSubmit}
      title="New task"
      subtitle={`${format(range.start, 'EEEE, MMM d, HH:mm')} – ${format(range.end, 'HH:mm')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || isPending}>
            Create
          </Button>
        </>
      }
    >
      <label className="mb-2 block text-xs text-text-secondary">
        Name
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full"
        />
      </label>
      <label className="block text-xs text-text-secondary">
        Definition of done
        <textarea
          value={definitionOfDone}
          onChange={(event) => setDefinitionOfDone(event.target.value)}
          rows={2}
          className="mt-1 w-full"
        />
      </label>
      {errorMessage && <p className="mt-2 text-xs text-danger">{errorMessage}</p>}
    </Dialog>
  )
}
