import type { UndoEntry } from '../undo/UndoProvider'
import type { ViewKey } from './views'

export interface DoneUndoMutators {
  markDoneAsync: (taskId: string) => Promise<unknown>
  revertDoneAsync: (taskId: string) => Promise<unknown>
}

/** No server-generated id is involved (a task's state just toggles between
 * two known values), so a simple symmetric pair suffices. Pushed after
 * mark-done succeeds: running it reverts back to in_progress and returns
 * the entry that re-marks it done. */
// Pushed from the nav timer's stop-confirm flow and from the Plan detail
// panel (the timer button / "Mark sprint done"). Since v08 removed the
// Execute view, everything that flips a task's state lives under Plan.
const AFFECTED_VIEWS: ViewKey[] = ['plan']

export function makeRevertDoneEntry(taskId: string, mutators: DoneUndoMutators): UndoEntry {
  return {
    label: 'Mark sprint done',
    views: AFFECTED_VIEWS,
    run: async () => {
      await mutators.revertDoneAsync(taskId)
      return makeMarkDoneEntry(taskId, mutators)
    },
  }
}

export function makeMarkDoneEntry(taskId: string, mutators: DoneUndoMutators): UndoEntry {
  return {
    label: 'Revert sprint done',
    views: AFFECTED_VIEWS,
    run: async () => {
      await mutators.markDoneAsync(taskId)
      return makeRevertDoneEntry(taskId, mutators)
    },
  }
}

// Right-click "Mark as done" on a task with children (item 9) marks every
// affected leaf in one bulk backend call -- undoing that must be ONE stack
// entry too, not one per leaf, so this can't just call makeRevertDoneEntry
// in a loop with separate pushUndo calls (that would produce N entries).
// Same symmetric-pair shape as above, just looping the single-task mutators
// over every affected id instead of acting on just one.
export function makeMarkSubtreeDoneUndoEntry(
  affectedIds: string[],
  mutators: DoneUndoMutators,
): UndoEntry {
  return {
    label: 'Mark subtree done',
    views: AFFECTED_VIEWS,
    run: async () => {
      for (const id of affectedIds) {
        await mutators.revertDoneAsync(id)
      }
      return makeMarkSubtreeRedoEntry(affectedIds, mutators)
    },
  }
}

function makeMarkSubtreeRedoEntry(affectedIds: string[], mutators: DoneUndoMutators): UndoEntry {
  return {
    label: 'Revert subtree done',
    views: AFFECTED_VIEWS,
    run: async () => {
      for (const id of affectedIds) {
        await mutators.markDoneAsync(id)
      }
      return makeMarkSubtreeDoneUndoEntry(affectedIds, mutators)
    },
  }
}
