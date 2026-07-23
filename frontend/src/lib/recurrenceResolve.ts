import type { RecurrenceUnit } from '../types'

/** ISO weekday convention matching the backend's `date.weekday()`: 0=Monday
 * .. 6=Sunday (JS's own `Date.getDay()` is 0=Sunday .. 6=Saturday). */
function isoWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

const MAX_WEEKS_TO_SCAN = 104 // 2 years -- generous upper bound, never expected to run out

/** Mirrors the backend's `occurrence_dates()` weekly-branch resolution: an
 * anchor date whose own weekday isn't among the selected days_of_week (or
 * whose week is skipped by the interval) doesn't produce a first occurrence
 * on the anchor date itself -- it resolves to the closest matching day at or
 * after the anchor. Surfaced in the UI so creating a routine on, say, a
 * Thursday with only "Monday" selected shows the real first-occurrence date
 * (next Monday) instead of leaving the user to infer it from an empty
 * current-week calendar view (see v05 item 11).
 */
export function resolveFirstOccurrenceDate(
  anchor: Date,
  interval: number,
  unit: RecurrenceUnit,
  daysOfWeek: number[],
): Date {
  if (unit !== 'week') return anchor

  const anchorDay = startOfDay(anchor)
  const weekdays = [...(daysOfWeek.length ? daysOfWeek : [isoWeekday(anchorDay)])].sort(
    (a, b) => a - b,
  )
  const anchorWeekStart = addDays(anchorDay, -isoWeekday(anchorDay))

  let weekStart = anchorWeekStart
  for (let weekIndex = 0; weekIndex < MAX_WEEKS_TO_SCAN; weekIndex += 1) {
    if (weekIndex % interval === 0) {
      for (const weekday of weekdays) {
        const candidate = addDays(weekStart, weekday)
        if (candidate >= anchorDay) return candidate
      }
    }
    weekStart = addDays(weekStart, 7)
  }
  return anchorDay
}
