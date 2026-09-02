import { useMemo, useState } from 'react'
import { useTasks } from '../api/tasks'
import { useIntervalsForWeek } from '../api/intervals'
import { useEntriesForWeek } from '../api/timer'
import { useEvaluatePeriod } from '../api/evaluate'
import { useExcuseFrequency } from '../api/excuses'
import EvaluateCalendar, {
  type EvaluateMode,
  type ExplainGapParams,
} from '../components/calendar/EvaluateCalendar'
import ExcusesPanel from '../components/evaluate/ExcusesPanel'
import ExplainGapDialog from '../components/evaluate/ExplainGapDialog'
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
import Button from '../components/common/Button'
import SegmentedControl from '../components/common/SegmentedControl'
import { ChevronLeft, ChevronRight } from '../components/common/icons'

const CALENDAR_MODES: { key: EvaluateMode; label: string }[] = [
  { key: 'planned', label: 'Planned' },
  { key: 'real', label: 'Real' },
  { key: 'diff', label: 'Diff' },
]

const SUBTABS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'excuses', label: 'Excuses' },
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
  const [explainGap, setExplainGap] = useState<ExplainGapParams | null>(null)

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

  const {
    data: excuseFrequency,
    isLoading: isExcusesLoading,
    isError: isExcusesError,
    error: excusesError,
  } = useExcuseFrequency(granularity, periodDate, selectedTaskIds)

  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks])

  function handleGranularityChange(next: Granularity) {
    setGranularity(next)
    setPeriodAnchor(utcNow())
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div className="flex items-center gap-3">
          <SegmentedControl
            ariaLabel="Evaluate view"
            segments={SUBTABS}
            value={subtab}
            onChange={setSubtab}
          />
          {subtab === 'calendar' ? (
            <>
              <Button
                variant="icon"
                size="sm"
                aria-label="Previous week"
                onClick={() => setWeekAnchor((prev) => shiftWeek(prev, -1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="icon"
                size="sm"
                aria-label="Next week"
                disabled={isCurrentWeek}
                onClick={() => setWeekAnchor((prev) => shiftWeek(prev, 1))}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={isCurrentWeek}
                onClick={() => setWeekAnchor(mondayOf(utcNow()))}
              >
                Today
              </Button>
              <span className="text-base font-medium text-text-primary">
                {formatWeekLabel(weekAnchor)}
              </span>
            </>
          ) : (
            <>
              <Button
                variant="icon"
                size="sm"
                aria-label="Previous period"
                onClick={() => setPeriodAnchor((prev) => shiftPeriod(granularity, prev, -1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="icon"
                size="sm"
                aria-label="Next period"
                disabled={isCurrentPeriod(granularity, periodAnchor)}
                onClick={() => setPeriodAnchor((prev) => shiftPeriod(granularity, prev, 1))}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={isCurrentPeriod(granularity, periodAnchor)}
                onClick={() => setPeriodAnchor(utcNow())}
              >
                Today
              </Button>
              <span className="text-base font-medium text-text-primary">
                {formatPeriodLabel(granularity, periodAnchor)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {subtab === 'calendar' ? (
            <>
              {mode === 'diff' && (
                <span className="hidden text-2xs text-text-tertiary lg:inline">
                  dashed = planned · solid = tracked · bold = missed
                </span>
              )}
              <SegmentedControl
                ariaLabel="Calendar mode"
                segments={CALENDAR_MODES.map((m) => ({ key: m.key, label: m.label }))}
                value={mode}
                onChange={setMode}
              />
            </>
          ) : (
            <>
              <SegmentedControl
                ariaLabel="Granularity"
                segments={GRANULARITIES.map((g) => ({ key: g.key, label: g.label }))}
                value={granularity}
                onChange={handleGranularityChange}
              />
              <TaskFilter
                tasks={tasks ?? []}
                selectedIds={selectedTaskIds}
                onChange={setSelectedTaskIds}
              />
            </>
          )}
        </div>
      </div>

      {subtab === 'calendar' && (
        <div className="min-h-0 flex-1 p-4">
          <EvaluateCalendar
            mode={mode}
            weekAnchor={weekAnchor}
            intervals={intervals}
            entries={entries}
            tasksById={tasksById}
            onExplainGap={setExplainGap}
          />
        </div>
      )}

      {explainGap && (
        <ExplainGapDialog
          taskId={explainGap.taskId}
          taskName={
            intervals.find((interval) => interval.id === explainGap.intervalId)?.task_name ??
            tasksById.get(explainGap.taskId)?.name ??
            'Unknown task'
          }
          intervalId={explainGap.intervalId}
          start={explainGap.start}
          end={explainGap.end}
          onClose={() => setExplainGap(null)}
        />
      )}

      {(subtab === 'metrics' || subtab === 'excuses') && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {subtab === 'metrics' && (
            <>
              {isLoading && (
                <div className="p-4 text-sm text-text-secondary">Loading stats…</div>
              )}
              {isError && (
                <div className="p-4 text-sm text-danger">
                  Failed to load stats: {(error as Error).message}
                </div>
              )}
              {evaluation && <StatsPanel result={evaluation} tasks={tasks ?? []} />}
            </>
          )}

          {subtab === 'excuses' && (
            <>
              {isExcusesLoading && (
                <div className="p-4 text-sm text-text-secondary">Loading excuses…</div>
              )}
              {isExcusesError && (
                <div className="p-4 text-sm text-danger">
                  Failed to load excuses: {(excusesError as Error).message}
                </div>
              )}
              {excuseFrequency && <ExcusesPanel result={excuseFrequency} />}
            </>
          )}
        </div>
      )}
    </div>
  )
}
