import { useState } from 'react'
import { useCreateInterval } from '../../api/intervals'
import IntervalTimeFields, {
  defaultTimeValue,
  intervalTimeToDates,
  type IntervalTimeValue,
} from './IntervalTimeFields'

export default function AddToCalendarModal({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const [value, setValue] = useState<IntervalTimeValue>(defaultTimeValue)
  const createInterval = useCreateInterval()

  const { start, end } = intervalTimeToDates(value)
  const canSubmit = end > start

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createInterval.mutate(
      { task_id: taskId, start: start.toISOString(), end: end.toISOString() },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl"
      >
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Add to calendar</h2>
        <IntervalTimeFields value={value} onChange={setValue} />
        {!canSubmit && (
          <p className="mt-2 text-xs text-danger">End time must be after start time.</p>
        )}
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
            disabled={!canSubmit || createInterval.isPending}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {createInterval.isError && (
          <p className="mt-2 text-xs text-danger">{(createInterval.error as Error).message}</p>
        )}
      </form>
    </div>
  )
}
