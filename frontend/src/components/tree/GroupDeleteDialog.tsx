export default function GroupDeleteDialog({
  groupName,
  onDeleteChildren,
  onUngroup,
  onCancel,
  isPending,
}: {
  groupName: string
  onDeleteChildren: () => void
  onUngroup: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <p className="text-sm text-text-primary">
          Delete the group &ldquo;{groupName}&rdquo;? Choose what happens to anything inside it.
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
            onClick={onUngroup}
            disabled={isPending}
            className="rounded bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50"
          >
            Ungroup
          </button>
          <button
            type="button"
            onClick={onDeleteChildren}
            disabled={isPending}
            className="rounded bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger-hover disabled:opacity-50"
          >
            Delete children too
          </button>
        </div>
      </div>
    </div>
  )
}
