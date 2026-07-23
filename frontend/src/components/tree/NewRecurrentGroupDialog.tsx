import { useState } from 'react'
import type { Task } from '../../types'
import { useCreateRecurrentGroup } from '../../api/recurrentTasks'

export default function NewRecurrentGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (task: Task) => void
}) {
  const [name, setName] = useState('')
  const createRecurrentGroup = useCreateRecurrentGroup()

  const canSubmit = name.trim().length > 0

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createRecurrentGroup.mutate({ name: name.trim() }, { onSuccess: onCreated })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-80 rounded-lg border border-border bg-surface p-4 shadow-xl"
      >
        <h2 className="mb-3 text-sm font-semibold text-text-primary">New recurrent group</h2>
        <label className="mb-3 block text-xs text-text-secondary">
          Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || createRecurrentGroup.isPending}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create
          </button>
        </div>
        {createRecurrentGroup.isError && (
          <p className="mt-2 text-xs text-danger">{(createRecurrentGroup.error as Error).message}</p>
        )}
      </form>
    </div>
  )
}
