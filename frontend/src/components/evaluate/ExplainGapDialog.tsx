import { useState } from 'react'
import { format } from 'date-fns'
import { useAttachExcuse, useExcuses } from '../../api/excuses'
import AlertDialog from '../common/AlertDialog'

export default function ExplainGapDialog({
  taskId,
  taskName,
  intervalId,
  start,
  end,
  onClose,
}: {
  taskId: string
  taskName: string
  intervalId: string
  start: Date
  end: Date
  onClose: () => void
}) {
  const { data: excuses = [] } = useExcuses()
  const [selectedExcuseId, setSelectedExcuseId] = useState('')
  const [newText, setNewText] = useState('')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const attachExcuse = useAttachExcuse()

  const canSubmit = Boolean(selectedExcuseId || newText.trim())

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    attachExcuse.mutate(
      {
        task_id: taskId,
        interval_id: intervalId,
        start: start.toISOString(),
        end: end.toISOString(),
        excuse_id: selectedExcuseId || undefined,
        new_excuse_text: selectedExcuseId ? undefined : newText.trim() || undefined,
      },
      {
        onSuccess: onClose,
        onError: (error) => setAlertMessage((error as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl"
      >
        <h2 className="mb-1 text-sm font-semibold text-text-primary">Explain this gap</h2>
        <p className="mb-3 text-xs text-text-secondary">
          {taskName}, {format(start, 'MMM d, HH:mm')}–{format(end, 'HH:mm')}
        </p>

        <label className="mb-1 block text-xs text-text-secondary" htmlFor="explain-gap-select">
          Pick an existing excuse
        </label>
        <select
          id="explain-gap-select"
          value={selectedExcuseId}
          onChange={(event) => {
            setSelectedExcuseId(event.target.value)
            if (event.target.value) setNewText('')
          }}
          className="mb-3 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
        >
          <option value="">Select an excuse…</option>
          {excuses.map((excuse) => (
            <option key={excuse.id} value={excuse.id}>
              {excuse.text}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs text-text-secondary" htmlFor="explain-gap-new-text">
          Or type a new one
        </label>
        <input
          id="explain-gap-new-text"
          type="text"
          value={newText}
          onChange={(event) => {
            setNewText(event.target.value)
            if (event.target.value) setSelectedExcuseId('')
          }}
          disabled={Boolean(selectedExcuseId)}
          placeholder="e.g. Meeting ran over"
          className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary disabled:opacity-50"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || attachExcuse.isPending}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
      {alertMessage && <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />}
    </div>
  )
}
