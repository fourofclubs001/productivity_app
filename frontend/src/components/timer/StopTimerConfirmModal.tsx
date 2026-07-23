export default function StopTimerConfirmModal({
  taskName,
  definitionOfDone,
  onMarkDone,
  onStopOnly,
  onCancel,
  isPending,
}: {
  taskName: string
  definitionOfDone: string
  onMarkDone: () => void
  onStopOnly: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">
          Is the definition of done fulfilled?
        </h2>
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {taskName}
        </p>
        <p className="mb-4 mt-1 text-sm text-text-primary">{definitionOfDone}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onStopOnly}
            disabled={isPending}
            className="rounded bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50"
          >
            No, stop the timer
          </button>
          <button
            type="button"
            onClick={onMarkDone}
            disabled={isPending}
            className="rounded bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success-hover disabled:opacity-50"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}
