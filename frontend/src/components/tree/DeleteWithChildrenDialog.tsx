export default function DeleteWithChildrenDialog({
  taskName,
  onDeleteChildren,
  onJustThisTask,
  onCancel,
  isPending,
}: {
  taskName: string
  onDeleteChildren: () => void
  onJustThisTask: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <p className="text-sm text-text-primary">
          Delete &ldquo;{taskName}&rdquo;? It has sub-tasks — choose what happens to them.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onJustThisTask}
            disabled={isPending}
            className="rounded bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50"
          >
            Just this task
          </button>
          <button
            type="button"
            onClick={onDeleteChildren}
            disabled={isPending}
            className="rounded bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger-hover disabled:opacity-50"
          >
            Delete whole subtree
          </button>
        </div>
      </div>
    </div>
  )
}
