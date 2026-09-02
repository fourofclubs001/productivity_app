import { useState } from 'react'
import type { Entry } from '../../types'
import { useUpdateEntry } from '../../api/timer'
import { makeUpdateEntryTimeEntry } from '../../lib/entryUndoEntries'
import { useUndo } from '../../undo/UndoProvider'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
import AlertDialog from '../common/AlertDialog'
import IntervalTimeFields, {
  intervalTimeToDates,
  type IntervalTimeValue,
} from './IntervalTimeFields'

function entryToTimeValue(entry: Entry): IntervalTimeValue {
  const start = new Date(entry.start)
  const end = entry.end ? new Date(entry.end) : start
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
  const t = (x: Date) => `${pad(x.getHours())}:${pad(x.getMinutes())}`
  return { startDate: d(start), startTime: t(start), endDate: d(end), endTime: t(end) }
}

// Precise typed editing of a tracked-time entry -- for cross-midnight
// entries (not drag/resizable) and anyone who prefers typing.
export default function EditEntryTimeModal({
  entry,
  onClose,
}: {
  entry: Entry
  onClose: () => void
}) {
  const [value, setValue] = useState<IntervalTimeValue>(() => entryToTimeValue(entry))
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const updateEntry = useUpdateEntry()
  const { pushUndo } = useUndo()

  const { start, end } = intervalTimeToDates(value)
  const canSubmit = end > start

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    const next = { start: start.toISOString(), end: end.toISOString() }
    const prev = { start: entry.start, end: entry.end ?? entry.start }
    updateEntry.mutate(
      { id: entry.id, input: next },
      {
        onSuccess: () => {
          pushUndo(makeUpdateEntryTimeEntry(entry.id, prev, next, updateEntry.mutateAsync))
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
      title="Edit tracked time"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || updateEntry.isPending}>
            Save
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
