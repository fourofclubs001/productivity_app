import { useState } from 'react'
import type { Task } from '../../types'
import { useCreateTask, usePalette } from '../../api/tasks'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
import ColorSwatchPicker from './ColorSwatchPicker'

export default function NewTaskDialog({
  parentId,
  onClose,
  onCreated,
}: {
  parentId: string | null
  onClose: () => void
  onCreated: (task: Task) => void
}) {
  const [name, setName] = useState('')
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const [colors, setColors] = useState<string[]>([])
  const { data: palette = [] } = usePalette()
  const createTask = useCreateTask()

  const canSubmit = name.trim().length > 0 && definitionOfDone.trim().length > 0

  function toggleColor(color: string) {
    setColors((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createTask.mutate(
      {
        name: name.trim(),
        definition_of_done: definitionOfDone.trim(),
        parent_ids: parentId ? [parentId] : [],
        colors,
      },
      { onSuccess: onCreated },
    )
  }

  return (
    <Dialog
      onClose={onClose}
      onSubmit={handleSubmit}
      title={parentId ? 'New sub-task' : 'New task'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || createTask.isPending}>
            Create
          </Button>
        </>
      }
    >
      <label className="mb-2 block text-xs text-text-secondary">
        Name
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full text-sm"
        />
      </label>
      <label className="mb-3 block text-xs text-text-secondary">
        Definition of done
        <textarea
          value={definitionOfDone}
          onChange={(event) => setDefinitionOfDone(event.target.value)}
          rows={3}
          className="mt-1 w-full text-sm"
        />
      </label>
      <label className="block text-xs text-text-secondary">
        Colors
        <div className="mt-1">
          <ColorSwatchPicker palette={palette} selected={colors} onToggle={toggleColor} />
        </div>
      </label>
      {createTask.isError && (
        <p className="mt-2 text-xs text-danger">{(createTask.error as Error).message}</p>
      )}
    </Dialog>
  )
}
