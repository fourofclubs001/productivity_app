export default function NewRecurrentItemChooserDialog({
  onChooseTask,
  onChooseGroup,
  onClose,
}: {
  onChooseTask: () => void
  onChooseGroup: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-72 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">New…</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onChooseTask}
            className="rounded border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            Recurrent task
          </button>
          <button
            type="button"
            onClick={onChooseGroup}
            className="rounded border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            Recurrent group
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
