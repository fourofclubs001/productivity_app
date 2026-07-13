export default function DoneConfirmModal({
  taskName,
  definitionOfDone,
  onConfirm,
  onDismiss,
  isPending,
}: {
  taskName: string
  definitionOfDone: string
  onConfirm: () => void
  onDismiss: () => void
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
            onClick={onDismiss}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            No, keep in progress
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success-hover disabled:opacity-50"
          >
            Yes, done
          </button>
        </div>
      </div>
    </div>
  )
}
