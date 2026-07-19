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
// Pushed from both Execute (TimerControl, after stopping a timer) and Plan
// (TaskDetailPanel's "Mark sprint done" button) -- either way it flips the
// task's state field, which both views' displays (StateBadge, timer
// eligibility) depend on, so it's tagged for both regardless of which one
// triggered it (v03 item 8's cross-view carve-out).
const AFFECTED_VIEWS: ViewKey[] = ['plan', 'execute']

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
