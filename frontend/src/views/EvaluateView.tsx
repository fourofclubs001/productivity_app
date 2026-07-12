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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor((prev) => shiftWeek(prev, -1))}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={isCurrentWeek}
            onClick={() => setWeekAnchor((prev) => shiftWeek(prev, 1))}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
          >
            Next →
          </button>
          <span className="text-sm text-neutral-300">
            Week of {formatWeekLabel(weekAnchor)}
            {isCurrentWeek && <span className="ml-1 text-neutral-500">(current)</span>}
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
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
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

      {isLoading && <div className="p-4 text-sm text-neutral-500">Loading stats…</div>}
      {isError && (
        <div className="p-4 text-sm text-red-400">
          Failed to load stats: {(error as Error).message}
        </div>
      )}
      {evaluation && <StatsPanel result={evaluation} />}
    </div>
  )
}
