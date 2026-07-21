import { addDays, isSameDay, startOfDay } from 'date-fns'

/**
 * react-big-calendar's week/day time grid doesn't render an event at all
 * when its start and end fall on different local calendar days (confirmed
 * via a throwaway debug spec during the v03 pass -- see PROJECT_STATUS.md).
 * Splitting such an event into one segment per day it spans, each clipped to
 * that day's boundary, works around this the same way the library's own
 * month view splits multi-day all-day events into per-day pieces.
 */
export function splitAcrossDays<T extends { start: Date; end: Date }>(event: T): T[] {
  if (event.end <= event.start || isSameDay(event.start, event.end)) return [event]

  const segments: T[] = []
  let segmentStart = event.start
  while (!isSameDay(segmentStart, event.end)) {
    const segmentEnd = startOfDay(addDays(segmentStart, 1))
    segments.push({ ...event, start: segmentStart, end: segmentEnd })
    segmentStart = segmentEnd
  }
  segments.push({ ...event, start: segmentStart, end: event.end })
  return segments
}
