import { useState } from 'react'
import { format } from 'date-fns'
import {
  useCreateEntry,
  useDeleteEntry,
  useEntriesForTask,
  useUpdateEntry,
} from '../../api/timer'
import {
  makeCreateEntryUndoEntry,
  makeUpdateEntryTimeEntry,
} from '../../lib/entryUndoEntries'
import { useUndo } from '../../undo/UndoProvider'
import IntervalTimeFields, {
  intervalTimeToDates,
  type IntervalTimeValue,
} from '../calendar/IntervalTimeFields'
import AlertDialog from '../common/AlertDialog'

function entryToTimeValue(startIso: string, endIso: string): IntervalTimeValue {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
  const t = (x: Date) => `${pad(x.getHours())}:${pad(x.getMinutes())}`
  const start = new Date(startIso)
  const end = new Date(endIso)
  return { startDate: d(start), startTime: t(start), endDate: d(end), endTime: t(end) }
}

// The past tracked-time entries for a leaf task, mirroring the "Sprint
// schedule" interval list -- inline edit + delete, both undoable, no Google
// sync (v08 item 4).
export default function TrackedTimeList({ taskId }: { taskId: string }) {
  const { data: entries = [] } = useEntriesForTask(taskId)
  const createEntry = useCreateEntry()
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const { pushUndo } = useUndo()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<IntervalTimeValue | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const entryMutators = {
    createEntryAsync: createEntry.mutateAsync,
    deleteEntryAsync: deleteEntry.mutateAsync,
  }

  const completed = entries.filter((entry) => entry.end)
  if (completed.length === 0) return null

  return (
    <div className="mt-6">
      <label className="block text-2xs font-medium uppercase tracking-wider text-text-secondary">
        Tracked time
      </label>
      <ul className="mt-2 space-y-1">
        {completed.map((entry) => {
          const end = entry.end as string
          if (editingId === entry.id && editValue) {
            const { start: es, end: ee } = intervalTimeToDates(editValue)
            const canSubmit = ee > es
            return (
              <li
                key={entry.id}
                className="rounded-sm bg-surface-alt px-2 py-1.5 text-xs text-text-secondary"
              >
                <IntervalTimeFields value={editValue} onChange={setEditValue} />
                {!canSubmit && <p className="mt-1 text-danger">End must be after start.</p>}
                <div className="mt-1.5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setEditValue(null)
                    }}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmit || updateEntry.isPending}
                    onClick={() => {
                      const next = { start: es.toISOString(), end: ee.toISOString() }
                      const prev = { start: entry.start, end }
                      updateEntry.mutate(
                        { id: entry.id, input: next },
                        {
                          onSuccess: () => {
                            pushUndo(
                              makeUpdateEntryTimeEntry(
                                entry.id,
                                prev,
                                next,
                                updateEntry.mutateAsync,
                              ),
                            )
                            setEditingId(null)
                            setEditValue(null)
                          },
                          onError: (error) => setAlertMessage((error as Error).message),
                        },
                      )
                    }}
                    className="font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </li>
            )
          }
          return (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded-sm bg-surface-alt px-2 py-1 text-xs text-text-secondary"
            >
              <button
                type="button"
                onClick={() => {
                  setEditingId(entry.id)
                  setEditValue(entryToTimeValue(entry.start, end))
                }}
                className="text-left hover:text-text-primary"
              >
                <span className="text-text-primary">
                  {format(new Date(entry.start), 'EEE MMM d')}
                </span>{' '}
                {format(new Date(entry.start), 'HH:mm')} – {format(new Date(end), 'HH:mm')}
              </button>
              <button
                type="button"
                title="Delete this tracked time"
                onClick={() =>
                  deleteEntry.mutate(entry.id, {
                    onSuccess: () => pushUndo(makeCreateEntryUndoEntry(entry, entryMutators)),
                    onError: (error) => setAlertMessage((error as Error).message),
                  })
                }
                className="text-text-secondary hover:text-danger"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      {alertMessage && <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />}
    </div>
  )
}
