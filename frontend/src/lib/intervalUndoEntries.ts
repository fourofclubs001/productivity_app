import type { Interval } from '../types'
import type { CreateIntervalInput } from '../api/intervals'
import type { UndoEntry } from '../undo/UndoProvider'

export interface IntervalUndoMutators {
  createIntervalAsync: (input: CreateIntervalInput) => Promise<Interval>
  deleteIntervalAsync: (id: string) => Promise<void>
}

interface TimeBounds {
  start: string
  end: string
}

/** Toggles an existing interval's start/end between two known snapshots --
 * no server-generated id is involved (unlike create/delete), so a simple
 * symmetric pair suffices: running it applies `target` and returns the
 * entry that applies `current` again. */
export function makeUpdateTimeEntry(
  intervalId: string,
  target: TimeBounds,
  current: TimeBounds,
  updateIntervalAsync: (args: { id: string; input: TimeBounds }) => Promise<Interval>,
): UndoEntry {
  return {
    label: 'Move/resize scheduled task',
    run: async () => {
      await updateIntervalAsync({ id: intervalId, input: target })
      return makeUpdateTimeEntry(intervalId, current, target, updateIntervalAsync)
    },
  }
}

/** Undoes a just-created interval by deleting it; redoing recreates it
 * (under a new server-generated id) via makeCreateIntervalEntry. Shared by
 * every interval-creation call site (drag-to-schedule, the "Add to
 * calendar" modal) and by delete's own undo (deleting is undone by
 * recreating, i.e. this same entry shape). */
export function makeDeleteIntervalEntry(
  interval: Interval,
  mutators: IntervalUndoMutators,
): UndoEntry {
  return {
    label: 'Add reserved time slot',
    run: async () => {
      await mutators.deleteIntervalAsync(interval.id)
      return makeCreateIntervalEntry(interval, mutators)
    },
  }
}

/** Undoes a just-deleted interval by recreating it; redoing deletes the
 * newly-recreated (differently-id'd) row again via makeDeleteIntervalEntry. */
export function makeCreateIntervalEntry(
  interval: Interval,
  mutators: IntervalUndoMutators,
): UndoEntry {
  return {
    label: 'Delete reserved time slot',
    run: async () => {
      const created = await mutators.createIntervalAsync({
        task_id: interval.task_id,
        start: interval.start,
        end: interval.end,
      })
      return makeDeleteIntervalEntry(created, mutators)
    },
  }
}
