export default function AddChildChooserDialog({
  onChooseNew,
  onChooseExisting,
  onClose,
}: {
  onChooseNew: () => void
  onChooseExisting: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Add child task</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onChooseNew}
            className="rounded border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            Create new task
          </button>
          <button
            type="button"
            onClick={onChooseExisting}
            className="rounded border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            Attach existing task
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
