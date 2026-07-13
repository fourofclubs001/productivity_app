import { useMemo, useState } from 'react'
import { useTasks } from '../api/tasks'
import { useIntervalsForWeek } from '../api/intervals'
import { useEntriesForWeek } from '../api/timer'
import { useEvaluateWeek } from '../api/evaluate'
import EvaluateCalendar, {
  type EvaluateMode,
} from '../components/calendar/EvaluateCalendar'
import StatsPanel from '../components/evaluate/StatsPanel'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../lib/week'

const MODES: { key: EvaluateMode; label: string }[] = [
  { key: 'planned', label: 'Planned' },
  { key: 'real', label: 'Real' },
  { key: 'diff', label: 'Diff' },
]

export default function EvaluateView() {
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(new Date()))
  const [mode, setMode] = useState<EvaluateMode>('diff')

  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(new Date())

  const { data: tasks } = useTasks()
  const { data: intervals = [] } = useIntervalsForWeek(weekStart)
  const { data: entries = [] } = useEntriesForWeek(weekStart)
  const { data: evaluation, isLoading, isError, error } = useEvaluateWeek(weekStart)

  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks])

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor((prev) => shiftWeek(prev, -1))}
            className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={isCurrentWeek}
            onClick={() => setWeekAnchor((prev) => shiftWeek(prev, 1))}
            className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-30"
          >
            Next →
          </button>
          <span className="text-sm text-text-secondary">
            Week of {formatWeekLabel(weekAnchor)}
            {isCurrentWeek && <span className="ml-1 text-text-secondary">(current)</span>}
          </span>
        </div>
        <div className="flex gap-1">
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                mode === key
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[500px] shrink-0 p-4">
        <EvaluateCalendar
          mode={mode}
          weekAnchor={weekAnchor}
          intervals={intervals}
          entries={entries}
          tasksById={tasksById}
        />
      </div>

      {isLoading && <div className="p-4 text-sm text-text-secondary">Loading stats…</div>}
      {isError && (
        <div className="p-4 text-sm text-danger">
          Failed to load stats: {(error as Error).message}
        </div>
      )}
      {evaluation && <StatsPanel result={evaluation} />}
    </div>
  )
}
