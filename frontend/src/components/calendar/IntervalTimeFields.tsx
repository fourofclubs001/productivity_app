import { format } from 'date-fns'
import type { Interval } from '../../types'

export interface IntervalTimeValue {
  day: string // yyyy-MM-dd
  startTime: string // HH:mm
  endTime: string // HH:mm
}

export function intervalTimeToDates(value: IntervalTimeValue): { start: Date; end: Date } {
  return {
    start: new Date(`${value.day}T${value.startTime}`),
    end: new Date(`${value.day}T${value.endTime}`),
  }
}

export function intervalToTimeValue(interval: Interval): IntervalTimeValue {
  const start = new Date(interval.start)
  const end = new Date(interval.end)
  return {
    day: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endTime: format(end, 'HH:mm'),
  }
}

export function defaultTimeValue(): IntervalTimeValue {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    day: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
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
    <div className="flex gap-2">
      <input
        aria-label="Day"
        type="date"
        value={value.day}
        onChange={(event) => onChange({ ...value, day: event.target.value })}
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
        aria-label="End hour"
        type="time"
        value={value.endTime}
        onChange={(event) => onChange({ ...value, endTime: event.target.value })}
        className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
      />
    </div>
  )
}
