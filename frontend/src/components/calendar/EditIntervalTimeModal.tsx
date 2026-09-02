import { useState } from 'react'
import type { Interval } from '../../types'
import { useUpdateInterval } from '../../api/intervals'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
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
    <Dialog
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Edit time"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || updateInterval.isPending}>
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
