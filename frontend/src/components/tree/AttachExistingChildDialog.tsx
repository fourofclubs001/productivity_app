import { useMemo } from 'react'
import type { Task } from '../../types'
import { ancestorIds, descendantIds } from '../../lib/taskTree'
import { useAddParent, useRemoveParent } from '../../api/tasks'
import { makeSetParentsEntry } from '../../lib/reparentUndo'
import { useUndo } from '../../undo/UndoProvider'
import TaskPicker from '../timer/TaskPicker'

// Reparents (moves) an existing task under `parentTask`, detaching it from
// its previous parent(s) -- distinct from the Requires picker's additive
// "add another parent" semantics.
export default function AttachExistingChildDialog({
  parentTask,
  tasksById,
  onClose,
}: {
  parentTask: Task
  tasksById: Map<string, Task>
  onClose: () => void
}) {
  const addParent = useAddParent()
  const removeParent = useRemoveParent()
  const { pushUndo } = useUndo()

  // Excludes: parentTask itself, its own descendants, and its own ancestors
  // (cycle prevention -- the backend also enforces this via CycleError, but
  // this keeps the picker from ever offering an obviously-invalid,
  // guaranteed-to-fail choice), plus any candidate that's already a direct
  // child of parentTask (attaching it again would be a no-op).
  const excludedIds = useMemo(() => {
    const excluded = descendantIds(parentTask.id, tasksById)
    for (const id of ancestorIds(parentTask.id, tasksById)) excluded.add(id)
    excluded.add(parentTask.id)
    return excluded
  }, [parentTask, tasksById])

  function attach(childId: string) {
    const child = tasksById.get(childId)
    if (!child) return
    const previousParentIds = [...child.parent_ids]
    addParent.mutate(
      { id: childId, parentId: parentTask.id },
      {
        onSuccess: async () => {
          for (const oldParentId of previousParentIds) {
            await removeParent.mutateAsync({ id: childId, parentId: oldParentId })
          }
          pushUndo(
            makeSetParentsEntry(childId, previousParentIds, [parentTask.id], {
              addParentAsync: addParent.mutateAsync,
              removeParentAsync: removeParent.mutateAsync,
            }),
          )
          onClose()
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      data-testid="attach-existing-child-dialog"
    >
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-2">
        <h2 className="mb-1 text-sm font-semibold text-text-primary">Attach existing task</h2>
        <p className="mb-3 text-xs text-text-secondary">
          Move an existing task to become a child of "{parentTask.name}".
        </p>
        <TaskPicker
          tasks={Array.from(tasksById.values())}
          selectedId=""
          onSelect={attach}
          isHidden={(candidate) =>
            excludedIds.has(candidate.id) || candidate.parent_ids.includes(parentTask.id)
          }
          isSelectable={() => true}
          placeholder="Select a task…"
          emptyMessage="No tasks available to attach"
        />
        <div className="mt-4 flex justify-end">
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
