import { useState } from 'react'
import type { Task } from '../../types'
import { useCreateRecurrentGroup } from '../../api/recurrentTasks'
import Dialog from '../common/Dialog'
import Button from '../common/Button'

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
    <Dialog
      onClose={onClose}
      onSubmit={handleSubmit}
      className="w-[340px]"
      title="New recurrent group"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || createRecurrentGroup.isPending}>
            Create
          </Button>
        </>
      }
    >
      <label className="block text-xs text-text-secondary">
        Name
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full"
        />
      </label>
      {createRecurrentGroup.isError && (
        <p className="mt-2 text-xs text-danger">{(createRecurrentGroup.error as Error).message}</p>
      )}
    </Dialog>
  )
}
