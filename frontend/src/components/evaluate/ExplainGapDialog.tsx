import { useState } from 'react'
import { format } from 'date-fns'
import { useAttachExcuse, useExcuses } from '../../api/excuses'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
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
    <Dialog
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Explain this gap"
      subtitle={`${taskName}, ${format(start, 'MMM d, HH:mm')}–${format(end, 'HH:mm')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || attachExcuse.isPending}>
            Save
          </Button>
        </>
      }
    >
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
        className="mb-3 w-full"
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
        className="w-full disabled:opacity-50"
      />
      {alertMessage && <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />}
    </Dialog>
  )
}
