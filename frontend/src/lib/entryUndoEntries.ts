import type { Entry } from '../types'
import type { UndoEntry } from '../undo/UndoProvider'

export interface EntryUndoMutators {
  createEntryAsync: (input: { task_id: string; start: string; end: string }) => Promise<Entry>
  deleteEntryAsync: (id: string) => Promise<void>
}

interface TimeBounds {
  start: string
  end: string
}

/** Toggles a tracked-time entry's start/end between two known snapshots --
 * mirrors makeUpdateTimeEntry for intervals. */
export function makeUpdateEntryTimeEntry(
  entryId: string,
  target: TimeBounds,
  current: TimeBounds,
  updateEntryAsync: (args: { id: string; input: TimeBounds }) => Promise<Entry>,
): UndoEntry {
  return {
    label: 'Move/resize tracked time',
    views: ['plan'],
    run: async () => {
      await updateEntryAsync({ id: entryId, input: target })
      return makeUpdateEntryTimeEntry(entryId, current, target, updateEntryAsync)
    },
  }
}

/** Undo of a just-deleted tracked-time entry: recreate it (new server id);
 * redo deletes the recreated row again. */
export function makeCreateEntryUndoEntry(entry: Entry, mutators: EntryUndoMutators): UndoEntry {
  return {
    label: 'Delete tracked time',
    views: ['plan'],
    run: async () => {
      const created = await mutators.createEntryAsync({
        task_id: entry.task_id,
        start: entry.start,
        end: entry.end ?? entry.start,
      })
      return makeDeleteEntryUndoEntry(created, mutators)
    },
  }
}

/** Undo of a just-created tracked-time entry: delete it; redo recreates. */
export function makeDeleteEntryUndoEntry(entry: Entry, mutators: EntryUndoMutators): UndoEntry {
  return {
    label: 'Add tracked time',
    views: ['plan'],
    run: async () => {
      await mutators.deleteEntryAsync(entry.id)
      return makeCreateEntryUndoEntry(entry, mutators)
    },
  }
}
