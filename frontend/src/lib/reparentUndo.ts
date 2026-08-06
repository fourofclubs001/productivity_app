import type { UndoEntry } from '../undo/UndoProvider'

export interface ReparentMutators {
  addParentAsync: (vars: { id: string; parentId: string }) => Promise<unknown>
  removeParentAsync: (vars: { id: string; parentId: string }) => Promise<unknown>
}

// Shared by the Plan tree's drag-reparent (TaskTree.tsx) and the "attach an
// existing task as a child" picker (AttachExistingChildDialog.tsx) -- both
// move a task from one set of parents to another. No server-generated id is
// involved (parent edges are set membership), so a simple symmetric pair
// suffices: running an entry applies `target` and returns the entry that
// applies `current` again.
export function makeSetParentsEntry(
  taskId: string,
  target: string[],
  current: string[],
  mutators: ReparentMutators,
): UndoEntry {
  return {
    label: 'Move task',
    views: ['plan'],
    run: async () => {
      for (const parentId of current) {
        await mutators.removeParentAsync({ id: taskId, parentId })
      }
      for (const parentId of target) {
        await mutators.addParentAsync({ id: taskId, parentId })
      }
      return makeSetParentsEntry(taskId, current, target, mutators)
    },
  }
}
