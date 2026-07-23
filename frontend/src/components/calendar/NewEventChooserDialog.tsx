import { format } from 'date-fns'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold text-text-primary">New…</h2>
        <p className="mb-3 text-xs text-text-secondary">
          {format(range.start, 'EEEE, MMM d, HH:mm')} – {format(range.end, 'HH:mm')}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onChooseExisting}
            className="rounded border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            Existing task
          </button>
          <button
            type="button"
            onClick={onChooseNotRecurringNew}
            className="rounded border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            New task (not recurring)
          </button>
          <button
            type="button"
            onClick={onChooseRecurringNew}
            className="rounded border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            New task (recurring)
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
