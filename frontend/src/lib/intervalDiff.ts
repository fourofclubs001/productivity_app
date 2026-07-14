import type { Entry, Interval } from '../types'

export interface DiffSegment {
  start: Date
  end: Date
  covered: boolean
}

export interface PlannedDiffSegment extends DiffSegment {
  intervalId: string
  taskId: string
}

interface Range {
  start: Date
  end: Date
}

/**
 * For a single planned interval, diffs it against a set of "real" tracked
 * ranges (already filtered to the same task) and returns an ordered list of
 * covered/uncovered sub-segments spanning the whole planned interval.
 */
export function computeIntervalDiff(planned: Range, realRanges: Range[]): DiffSegment[] {
  const clipped = realRanges
    .map((range) => ({
      start: range.start < planned.start ? planned.start : range.start,
      end: range.end > planned.end ? planned.end : range.end,
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: Range[] = []
  for (const range of clipped) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      if (range.end > last.end) last.end = range.end
    } else {
      merged.push({ ...range })
    }
  }

  const segments: DiffSegment[] = []
  let cursor = planned.start
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ start: cursor, end: range.start, covered: false })
    }
    segments.push({ start: range.start, end: range.end, covered: true })
    cursor = range.end
  }
  if (cursor < planned.end) {
    segments.push({ start: cursor, end: planned.end, covered: false })
  }

  return segments.filter((segment) => segment.end > segment.start)
}

/**
 * Diffs every planned interval in a week against the full set of real
 * entries (filtering each to the matching task_id), for diff-mode rendering.
 */
export function computeDiffSegments(intervals: Interval[], entries: Entry[]): PlannedDiffSegment[] {
  const result: PlannedDiffSegment[] = []
  for (const interval of intervals) {
    const planned = { start: new Date(interval.start), end: new Date(interval.end) }
    const realRanges = entries
      .filter((entry) => entry.task_id === interval.task_id)
      .map((entry) => ({
        start: new Date(entry.start),
        end: entry.end ? new Date(entry.end) : new Date(),
      }))
    for (const segment of computeIntervalDiff(planned, realRanges)) {
      result.push({ ...segment, intervalId: interval.id, taskId: interval.task_id })
    }
  }
  return result
}
