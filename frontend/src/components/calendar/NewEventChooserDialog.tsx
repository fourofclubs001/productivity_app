import { format } from 'date-fns'
import Dialog from '../common/Dialog'
import Button from '../common/Button'

const choice =
  'rounded-sm border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover'

export default function NewEventChooserDialog({
  range,
  onChooseRecurringNew,
  onChooseNotRecurringNew,
  onChooseExisting,
  onClose,
}: {
  range: { start: Date; end: Date }
  onChooseRecurringNew: () => void
  onChooseNotRecurringNew: () => void
  onChooseExisting: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      onClose={onClose}
      className="w-[340px]"
      title="New…"
      subtitle={`${format(range.start, 'EEEE, MMM d, HH:mm')} – ${format(range.end, 'HH:mm')}`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onChooseExisting} className={choice}>
          Existing task
        </button>
        <button type="button" onClick={onChooseNotRecurringNew} className={choice}>
          New task (not recurring)
        </button>
        <button type="button" onClick={onChooseRecurringNew} className={choice}>
          New task (recurring)
        </button>
      </div>
    </Dialog>
  )
}
