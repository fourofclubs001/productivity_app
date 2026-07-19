import { format } from 'date-fns'
import type { Interval } from '../../types'

export interface IntervalTimeValue {
  startDate: string // yyyy-MM-dd
  startTime: string // HH:mm
  endDate: string // yyyy-MM-dd
  endTime: string // HH:mm
}

export function intervalTimeToDates(value: IntervalTimeValue): { start: Date; end: Date } {
  return {
    start: new Date(`${value.startDate}T${value.startTime}`),
    end: new Date(`${value.endDate}T${value.endTime}`),
  }
}

export function intervalToTimeValue(interval: Interval): IntervalTimeValue {
  const start = new Date(interval.start)
  const end = new Date(interval.end)
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endDate: format(end, 'yyyy-MM-dd'),
    endTime: format(end, 'HH:mm'),
  }
}

export function defaultTimeValue(): IntervalTimeValue {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const naturalEnd = new Date(start.getTime() + 60 * 60 * 1000)
  // The default 1-hour slot is meant to be a same-day quick suggestion --
  // if that would tip over into the next calendar day, clamp to just
  // before midnight instead. PlanCalendar's week/day grid (react-big-
  // calendar) doesn't render a chip for an event whose date range spans
  // midnight, so defaulting into one would silently produce an invisible
  // event; a deliberate midnight-crossing interval is still possible by
  // editing the date fields directly, with that rendering gap as a known
  // limitation (see PROJECT_STATUS.md).
  let end = naturalEnd
  if (naturalEnd.getDate() !== start.getDate()) {
    end = new Date(start)
    end.setHours(23, 59, 0, 0)
  }
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endDate: format(end, 'yyyy-MM-dd'),
    endTime: format(end, 'HH:mm'),
  }
}

export default function IntervalTimeFields({
  value,
  onChange,
}: {
  value: IntervalTimeValue
  onChange: (next: IntervalTimeValue) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        aria-label="Start date"
        type="date"
        value={value.startDate}
        onChange={(event) => onChange({ ...value, startDate: event.target.value })}
        className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
      />
      <input
        aria-label="Start hour"
        type="time"
        value={value.startTime}
        onChange={(event) => onChange({ ...value, startTime: event.target.value })}
        className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
      />
      <input
        aria-label="End date"
        type="date"
        value={value.endDate}
        onChange={(event) => onChange({ ...value, endDate: event.target.value })}
        className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
      />
      <input
        aria-label="End hour"
        type="time"
        value={value.endTime}
        onChange={(event) => onChange({ ...value, endTime: event.target.value })}
        className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
      />
    </div>
  )
}
