import { useState } from 'react'
import { format } from 'date-fns'
import type { Task } from '../../types'
import { useCreateRecurrentTask } from '../../api/recurrentTasks'
import { usePalette } from '../../api/tasks'
import { resolveFirstOccurrenceDate } from '../../lib/recurrenceResolve'
import Dialog from '../common/Dialog'
import Button from '../common/Button'
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

function rangeToTimeValue(start: Date, end: Date): IntervalTimeValue {
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endDate: format(end, 'yyyy-MM-dd'),
    endTime: format(end, 'HH:mm'),
  }
}

export default function NewRecurrentTaskDialog({
  onClose,
  onCreated,
  initialRange,
}: {
  onClose: () => void
  onCreated: (task: Task) => void
  initialRange?: { start: Date; end: Date }
}) {
  const [name, setName] = useState('')
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const [colors, setColors] = useState<string[]>([])
  const [timeValue, setTimeValue] = useState<IntervalTimeValue>(() =>
    initialRange ? rangeToTimeValue(initialRange.start, initialRange.end) : defaultTimeValue(),
  )
  const [recurrence, setRecurrence] = useState<RecurrenceRuleValue>(defaultRecurrenceRuleValue)
  const { data: palette = [] } = usePalette()
  const createRecurrentTask = useCreateRecurrentTask()

  const { start, end } = intervalTimeToDates(timeValue)
  const canSubmit = name.trim().length > 0 && definitionOfDone.trim().length > 0 && end > start
  const resolvedFirstOccurrence = resolveFirstOccurrenceDate(
    start,
    recurrence.interval,
    recurrence.unit,
    recurrence.daysOfWeek,
  )

  function toggleColor(color: string) {
    setColors((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]))
  }

  function handleTimeChange(next: IntervalTimeValue) {
    const { start: nextStart, end: nextEnd } = intervalTimeToDates(next)
    if (nextStart >= nextEnd) {
      setTimeValue({ ...next, endDate: next.startDate, endTime: next.startTime })
    } else {
      setTimeValue(next)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createRecurrentTask.mutate(
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
    <Dialog
      onClose={onClose}
      onSubmit={handleSubmit}
      title="New recurrent task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || createRecurrentTask.isPending}>
            Create
          </Button>
        </>
      }
    >
      <label className="mb-2 block text-xs text-text-secondary">
        Name
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full"
        />
      </label>
      <label className="mb-3 block text-xs text-text-secondary">
        Definition of done
        <textarea
          value={definitionOfDone}
          onChange={(event) => setDefinitionOfDone(event.target.value)}
          rows={2}
          className="mt-1 w-full"
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
          <IntervalTimeFields value={timeValue} onChange={handleTimeChange} />
        </div>
      </div>
      <div className="border-t border-border pt-3">
        <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-secondary">
          Custom recurrence
        </h3>
        <RecurrenceRuleFields value={recurrence} onChange={setRecurrence} />
        {end > start && (
          <p className="mt-2 text-xs text-text-secondary">
            First occurrence: <strong>{format(resolvedFirstOccurrence, 'EEEE, MMM d, yyyy')}</strong>
          </p>
        )}
      </div>
      {createRecurrentTask.isError && (
        <p className="mt-2 text-xs text-danger">{(createRecurrentTask.error as Error).message}</p>
      )}
    </Dialog>
  )
}
