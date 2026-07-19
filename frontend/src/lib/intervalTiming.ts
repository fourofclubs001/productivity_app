export interface TimeRange {
  start: Date
  end: Date
}

/** Fully elapsed: both start and end are before now. */
export function isFullyPast(range: TimeRange, now: Date): boolean {
  return range.end <= now
}

/** now falls inside the range: start has passed but end hasn't. */
export function isInProgress(range: TimeRange, now: Date): boolean {
  return range.start <= now && now < range.end
}

/** Not yet started: start is still ahead of now. */
export function isFullyFuture(range: TimeRange, now: Date): boolean {
  return range.start > now
}

export type DragRescheduleAction =
  | { type: 'update' }
  | { type: 'create' }
  | { type: 'reject'; message: string }

const EDIT_LOCK_MESSAGE =
  'This time slot has already started or ended and can no longer be edited that way'

/**
 * Decides what dragging an existing Plan calendar chip's start to a new
 * time should do. Normally it's a plain update -- but dragging a locked
 * (past or in-progress) chip's start forward is a deliberate exception to
 * that lock (v03 item 1): rather than rewriting history, it creates a new
 * interval at the drop target and leaves the original untouched, turning
 * the gesture into a copy rather than a move. Dragging a locked chip to
 * another past slot has no backdating use case and is still rejected.
 */
export function resolveDragRescheduleAction(
  previous: TimeRange,
  newStart: Date,
  now: Date,
): DragRescheduleAction {
  const startChanged = newStart.getTime() !== previous.start.getTime()
  const wasLocked = isFullyPast(previous, now) || isInProgress(previous, now)
  if (!wasLocked || !startChanged) return { type: 'update' }
  if (newStart <= now) return { type: 'reject', message: EDIT_LOCK_MESSAGE }
  return { type: 'create' }
}
