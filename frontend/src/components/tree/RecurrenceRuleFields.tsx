import type { RecurrenceEndType, RecurrenceUnit } from '../../types'

export interface RecurrenceRuleValue {
  interval: number
  unit: RecurrenceUnit
  daysOfWeek: number[]
  endType: RecurrenceEndType
  endDate: string // yyyy-MM-dd
  endCount: number
}

export function defaultRecurrenceRuleValue(): RecurrenceRuleValue {
  return { interval: 1, unit: 'week', daysOfWeek: [], endType: 'never', endDate: '', endCount: 13 }
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const UNIT_LABELS: Record<RecurrenceUnit, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
}

export default function RecurrenceRuleFields({
  value,
  onChange,
}: {
  value: RecurrenceRuleValue
  onChange: (next: RecurrenceRuleValue) => void
}) {
  function toggleDay(day: number) {
    const next = value.daysOfWeek.includes(day)
      ? value.daysOfWeek.filter((d) => d !== day)
      : [...value.daysOfWeek, day]
    onChange({ ...value, daysOfWeek: next })
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-xs text-text-secondary">Repeat every</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            aria-label="Repeat interval"
            type="number"
            min={1}
            value={value.interval}
            onChange={(event) =>
              onChange({ ...value, interval: Math.max(1, Number(event.target.value) || 1) })
            }
            className="w-16 rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary"
          />
          <select
            aria-label="Repeat unit"
            value={value.unit}
            onChange={(event) => onChange({ ...value, unit: event.target.value as RecurrenceUnit })}
            className="rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary"
          >
            {(Object.keys(UNIT_LABELS) as RecurrenceUnit[]).map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit]}
                {value.interval === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {value.unit === 'week' && (
        <div>
          <span className="block text-xs text-text-secondary">Repeat on</span>
          <div className="mt-1 flex gap-1">
            {DAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                aria-pressed={value.daysOfWeek.includes(day)}
                onClick={() => toggleDay(day)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  value.daysOfWeek.includes(day)
                    ? 'bg-accent text-white'
                    : 'bg-surface-alt text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="block text-xs text-text-secondary">Ends</span>
        <div className="mt-1 space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="radio"
              name="recurrence-end-type"
              checked={value.endType === 'never'}
              onChange={() => onChange({ ...value, endType: 'never' })}
            />
            Never
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="radio"
              name="recurrence-end-type"
              checked={value.endType === 'on_date'}
              onChange={() => onChange({ ...value, endType: 'on_date' })}
            />
            On
            <input
              aria-label="Ends on date"
              type="date"
              value={value.endDate}
              disabled={value.endType !== 'on_date'}
              onChange={(event) => onChange({ ...value, endDate: event.target.value })}
              className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary disabled:opacity-50"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="radio"
              name="recurrence-end-type"
              checked={value.endType === 'after_count'}
              onChange={() => onChange({ ...value, endType: 'after_count' })}
            />
            After
            <input
              aria-label="Ends after occurrences"
              type="number"
              min={1}
              value={value.endCount}
              disabled={value.endType !== 'after_count'}
              onChange={(event) =>
                onChange({ ...value, endCount: Math.max(1, Number(event.target.value) || 1) })
              }
              className="w-16 rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary disabled:opacity-50"
            />
            occurrences
          </label>
        </div>
      </div>
    </div>
  )
}
