import { useState } from 'react'
import type { Interval } from '../../types'
import { useUpdateInterval } from '../../api/intervals'
import IntervalTimeFields, {
  intervalTimeToDates,
  intervalToTimeValue,
  type IntervalTimeValue,
} from './IntervalTimeFields'
import AlertDialog from '../common/AlertDialog'

export default function EditIntervalTimeModal({
  interval,
  onClose,
}: {
  interval: Interval
  onClose: () => void
}) {
  const [value, setValue] = useState<IntervalTimeValue>(() => intervalToTimeValue(interval))
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const updateInterval = useUpdateInterval()

  const { start, end } = intervalTimeToDates(value)
  const canSubmit = end > start

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    updateInterval.mutate(
      { id: interval.id, input: { start: start.toISOString(), end: end.toISOString() } },
      { onSuccess: onClose, onError: (error) => setAlertMessage((error as Error).message) },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl"
      >
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Edit time</h2>
        <IntervalTimeFields value={value} onChange={setValue} />
        {!canSubmit && <p className="mt-2 text-xs text-danger">End must be after start.</p>}
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
            disabled={!canSubmit || updateInterval.isPending}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
      {alertMessage && (
        <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </div>
  )
}
