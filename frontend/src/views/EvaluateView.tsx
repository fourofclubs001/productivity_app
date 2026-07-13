import { useMemo, useState } from 'react'
import { useTasks } from '../api/tasks'
import { useIntervalsForWeek } from '../api/intervals'
import { useEntriesForWeek } from '../api/timer'
import { useEvaluatePeriod } from '../api/evaluate'
import EvaluateCalendar, { type EvaluateMode } from '../components/calendar/EvaluateCalendar'
import StatsPanel from '../components/evaluate/StatsPanel'
import TaskFilter from '../components/evaluate/TaskFilter'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../lib/week'
import {
  formatPeriodLabel,
  isCurrentPeriod,
  periodAnchorKey,
  shiftPeriod,
  type Granularity,
} from '../lib/period'
import { utcNow } from '../lib/time'

const CALENDAR_MODES: { key: EvaluateMode; label: string }[] = [
  { key: 'planned', label: 'Planned' },
  { key: 'real', label: 'Real' },
  { key: 'diff', label: 'Diff' },
]

const SUBTABS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'metrics', label: 'Metrics' },
] as const
type SubtabKey = (typeof SUBTABS)[number]['key']

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

export default function EvaluateView() {
  const [subtab, setSubtab] = useState<SubtabKey>('calendar')

  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(utcNow()))
  const [mode, setMode] = useState<EvaluateMode>('diff')
  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(utcNow())

  const [granularity, setGranularity] = useState<Granularity>('week')
  const [periodAnchor, setPeriodAnchor] = useState(() => utcNow())
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])

  const { data: tasks } = useTasks()
  const { data: intervals = [] } = useIntervalsForWeek(weekStart)
  const { data: entries = [] } = useEntriesForWeek(weekStart)

  const periodDate = periodAnchorKey(granularity, periodAnchor)
  const {
    data: evaluation,
    isLoading,
    isError,
    error,
  } = useEvaluatePeriod(granularity, periodDate, selectedTaskIds)

  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks])

  function handleGranularityChange(next: Granularity) {
    setGranularity(next)
    setPeriodAnchor(utcNow())
  }

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col overflow-y-auto">
      <div className="flex items-center gap-1 border-b border-border px-4 pt-2">
        {SUBTABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubtab(key)}
            className={`rounded-t px-3 py-2 text-sm font-medium ${
              subtab === key
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subtab === 'calendar' && (
        <>
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
              {CALENDAR_MODES.map(({ key, label }) => (
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
        </>
      )}

      {subtab === 'metrics' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPeriodAnchor((prev) => shiftPeriod(granularity, prev, -1))}
                className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={isCurrentPeriod(granularity, periodAnchor)}
                onClick={() => setPeriodAnchor((prev) => shiftPeriod(granularity, prev, 1))}
                className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-30"
              >
                Next →
              </button>
              <span className="text-sm text-text-secondary">
                {formatPeriodLabel(granularity, periodAnchor)}
                {isCurrentPeriod(granularity, periodAnchor) && (
                  <span className="ml-1 text-text-secondary">(current)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {GRANULARITIES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleGranularityChange(key)}
                    className={`rounded px-3 py-1 text-xs font-medium ${
                      granularity === key
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TaskFilter
                tasks={tasks ?? []}
                selectedIds={selectedTaskIds}
                onChange={setSelectedTaskIds}
              />
            </div>
          </div>

          {isLoading && <div className="p-4 text-sm text-text-secondary">Loading stats…</div>}
          {isError && (
            <div className="p-4 text-sm text-danger">
              Failed to load stats: {(error as Error).message}
            </div>
          )}
          {evaluation && <StatsPanel result={evaluation} />}
        </>
      )}
    </div>
  )
}
