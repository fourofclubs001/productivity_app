import type { UndoEntry } from '../undo/UndoProvider'

export interface DoneUndoMutators {
  markDoneAsync: (taskId: string) => Promise<unknown>
  revertDoneAsync: (taskId: string) => Promise<unknown>
}

/** No server-generated id is involved (a task's state just toggles between
 * two known values), so a simple symmetric pair suffices. Pushed after
 * mark-done succeeds: running it reverts back to in_progress and returns
 * the entry that re-marks it done. */
export function makeRevertDoneEntry(taskId: string, mutators: DoneUndoMutators): UndoEntry {
  return {
    label: 'Mark sprint done',
    run: async () => {
      await mutators.revertDoneAsync(taskId)
      return makeMarkDoneEntry(taskId, mutators)
    },
  }
}

export function makeMarkDoneEntry(taskId: string, mutators: DoneUndoMutators): UndoEntry {
  return {
    label: 'Revert sprint done',
    run: async () => {
      await mutators.markDoneAsync(taskId)
      return makeRevertDoneEntry(taskId, mutators)
    },
  }
}
