import { useState } from 'react'
import { useCreateInterval, useDeleteInterval } from '../../api/intervals'
import { makeDeleteIntervalEntry } from '../../lib/intervalUndoEntries'
import { useUndo } from '../../undo/UndoProvider'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
import IntervalTimeFields, {
  defaultTimeValue,
  intervalTimeToDates,
  type IntervalTimeValue,
} from './IntervalTimeFields'
import AlertDialog from '../common/AlertDialog'

export default function AddToCalendarModal({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const [value, setValue] = useState<IntervalTimeValue>(defaultTimeValue)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const createInterval = useCreateInterval()
  const deleteInterval = useDeleteInterval()
  const { pushUndo } = useUndo()

  const { start, end } = intervalTimeToDates(value)
  const canSubmit = end > start

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createInterval.mutate(
      { task_id: taskId, start: start.toISOString(), end: end.toISOString() },
      {
        onSuccess: (created) => {
          pushUndo(
            makeDeleteIntervalEntry(created, {
              createIntervalAsync: createInterval.mutateAsync,
              deleteIntervalAsync: deleteInterval.mutateAsync,
            }),
          )
          onClose()
        },
        onError: (error) => setAlertMessage((error as Error).message),
      },
    )
  }

  return (
    <Dialog
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Add to calendar"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || createInterval.isPending}>
            Add
          </Button>
        </>
      }
    >
      <IntervalTimeFields value={value} onChange={setValue} />
      {!canSubmit && <p className="mt-2 text-xs text-danger">End must be after start.</p>}
      {alertMessage && (
        <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </Dialog>
  )
}
