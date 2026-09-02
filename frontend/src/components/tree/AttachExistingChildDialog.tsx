import { useMemo } from 'react'
import type { Task } from '../../types'
import { ancestorIds, descendantIds } from '../../lib/taskTree'
import { useAddParent, useRemoveParent } from '../../api/tasks'
import { makeSetParentsEntry } from '../../lib/reparentUndo'
import { useUndo } from '../../undo/UndoProvider'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
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
    <Dialog
      onClose={onClose}
      testId="attach-existing-child-dialog"
      title="Attach existing task"
      subtitle={`Move an existing task to become a child of "${parentTask.name}".`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
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
    </Dialog>
  )
}
