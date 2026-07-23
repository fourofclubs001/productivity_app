import { useState } from 'react'
import { format } from 'date-fns'
import type { Task } from '../../types'
import { useCreateRoutine } from '../../api/routines'
import { usePalette } from '../../api/tasks'
import { resolveFirstOccurrenceDate } from '../../lib/recurrenceResolve'
import IntervalTimeFields, {
  defaultTimeValue,
  intervalTimeToDates,
  type IntervalTimeValue,
} from '../calendar/IntervalTimeFields'
import ColorSwatchPicker from './ColorSwatchPicker'
import RecurrenceRuleFields, {
  defaultRecurrenceRuleValue,
  type RecurrenceRuleValue,
} from './RecurrenceRuleFields'

export default function NewRoutineDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (task: Task) => void
}) {
  const [name, setName] = useState('')
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const [colors, setColors] = useState<string[]>([])
  const [timeValue, setTimeValue] = useState<IntervalTimeValue>(defaultTimeValue)
  const [recurrence, setRecurrence] = useState<RecurrenceRuleValue>(defaultRecurrenceRuleValue)
  const { data: palette = [] } = usePalette()
  const createRoutine = useCreateRoutine()

  const { start, end } = intervalTimeToDates(timeValue)
  // A weekly rule with no day selected defaults server-side to the first
  // occurrence's own weekday, so an empty selection is valid, not blocked.
  const canSubmit = name.trim().length > 0 && definitionOfDone.trim().length > 0 && end > start
  // The chosen start date doesn't have to be a day the recurrence actually
  // falls on (e.g. picking only "Monday" while start is left on today,
  // a Thursday) -- creation still succeeds and resolves to the closest
  // matching day, but with no visible chip on the current week's calendar
  // that can look like nothing happened. Show what will actually be
  // scheduled so success is confirmed rather than inferred (v05 item 11).
  const resolvedFirstOccurrence = resolveFirstOccurrenceDate(
    start,
    recurrence.interval,
    recurrence.unit,
    recurrence.daysOfWeek,
  )

  function toggleColor(color: string) {
    setColors((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createRoutine.mutate(
      {
        name: name.trim(),
        definition_of_done: definitionOfDone.trim(),
        colors,
        start: start.toISOString(),
        end: end.toISOString(),
        recurrence_interval: recurrence.interval,
        recurrence_unit: recurrence.unit,
        recurrence_days_of_week: recurrence.daysOfWeek,
        recurrence_end_type: recurrence.endType,
        ...(recurrence.endType === 'on_date' && recurrence.endDate
          ? { recurrence_end_date: recurrence.endDate }
          : {}),
        ...(recurrence.endType === 'after_count' ? { recurrence_end_count: recurrence.endCount } : {}),
      },
      { onSuccess: onCreated },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-96 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-xl"
      >
        <h2 className="mb-3 text-sm font-semibold text-text-primary">New routine</h2>
        <label className="mb-2 block text-xs text-text-secondary">
          Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <label className="mb-3 block text-xs text-text-secondary">
          Definition of done
          <textarea
            value={definitionOfDone}
            onChange={(event) => setDefinitionOfDone(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <label className="mb-3 block text-xs text-text-secondary">
          Colors
          <div className="mt-1">
            <ColorSwatchPicker palette={palette} selected={colors} onToggle={toggleColor} />
          </div>
        </label>
        <div className="mb-3">
          <span className="block text-xs text-text-secondary">First occurrence</span>
          <div className="mt-1">
            <IntervalTimeFields value={timeValue} onChange={setTimeValue} />
          </div>
          {!(end > start) && <p className="mt-1 text-xs text-danger">End must be after start.</p>}
        </div>
        <div className="mb-4 border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Custom recurrence
          </h3>
          <RecurrenceRuleFields value={recurrence} onChange={setRecurrence} />
          {end > start && (
            <p className="mt-2 text-xs text-text-secondary">
              First occurrence: <strong>{format(resolvedFirstOccurrence, 'EEEE, MMM d, yyyy')}</strong>
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || createRoutine.isPending}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create
          </button>
        </div>
        {createRoutine.isError && (
          <p className="mt-2 text-xs text-danger">{(createRoutine.error as Error).message}</p>
        )}
      </form>
    </div>
  )
}
