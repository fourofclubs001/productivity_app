import { useEffect, useMemo, useState } from 'react'
import { Calendar } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import type { Entry, Interval, Task } from '../../types'
import { localizer } from '../../lib/calendarLocalizer'
import { computeDiffSegments } from '../../lib/intervalDiff'
import { isFullyPast } from '../../lib/intervalTiming'
import { splitAcrossDays } from '../../lib/splitEventAcrossDays'
import { chipFillStyle, primaryChipColor } from './eventColor'
import CalendarDayHeader from './CalendarDayHeader'
import CalendarTimezoneLabel from './CalendarTimezoneLabel'

export type EvaluateMode = 'planned' | 'real' | 'diff'

export interface ExplainGapParams {
  taskId: string
  intervalId: string
  start: Date
  end: Date
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  colors: string[]
  kind: 'planned' | 'real'
  taskId?: string
  intervalId?: string
  diffKind?: 'covered' | 'uncovered'
}

export default function EvaluateCalendar({
  mode,
  weekAnchor,
  intervals,
  entries,
  tasksById,
  onExplainGap,
}: {
  mode: EvaluateMode
  weekAnchor: Date
  intervals: Interval[]
  entries: Entry[]
  tasksById: Map<string, Task>
  onExplainGap?: (params: ExplainGapParams) => void
}) {
  const intervalsById = useMemo(
    () => new Map(intervals.map((interval) => [interval.id, interval])),
    [intervals],
  )

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const events = useMemo<CalendarEvent[]>(() => {
    const planned: CalendarEvent[] = intervals.flatMap((interval) => {
      const task = tasksById.get(interval.task_id)
      return splitAcrossDays({
        id: `interval-${interval.id}`,
        title: interval.task_name ?? task?.name ?? 'Unknown task',
        start: new Date(interval.start),
        end: new Date(interval.end),
        colors: task?.effective_colors ?? [],
        kind: 'planned' as const,
      })
    })

    const real: CalendarEvent[] = entries.flatMap((entry) => {
      const task = tasksById.get(entry.task_id)
      return splitAcrossDays({
        id: `entry-${entry.id}`,
        title: entry.task_name ?? task?.name ?? 'Unknown task',
        start: new Date(entry.start),
        end: entry.end ? new Date(entry.end) : new Date(),
        colors: task?.effective_colors ?? [],
        kind: 'real' as const,
      })
    })

    if (mode === 'planned') return planned
    if (mode === 'real') return real

    // Diff mode splits each planned interval into covered/uncovered
    // sub-segments instead of rendering it as one solid chip. The separate
    // `real` chips are still concatenated as-is (unchanged from before) so
    // tracked time with no corresponding plan stays visible.
    const diffSegments: CalendarEvent[] = computeDiffSegments(intervals, entries).flatMap(
      (segment, index) => {
        const task = tasksById.get(segment.taskId)
        const sourceInterval = intervalsById.get(segment.intervalId)
        return splitAcrossDays({
          id: `diff-${segment.intervalId}-${index}`,
          title: sourceInterval?.task_name ?? task?.name ?? 'Unknown task',
          start: segment.start,
          end: segment.end,
          colors: task?.effective_colors ?? [],
          kind: 'planned' as const,
          taskId: segment.taskId,
          intervalId: segment.intervalId,
          diffKind: segment.covered ? ('covered' as const) : ('uncovered' as const),
        })
      },
    )
    return [...diffSegments, ...real]
  }, [mode, intervals, entries, tasksById, intervalsById])

  return (
    <Calendar
      localizer={localizer}
      events={events}
      defaultView="week"
      views={['week']}
      date={weekAnchor}
      onNavigate={() => {}}
      toolbar={false}
      selectable={false}
      onSelectEvent={(event: CalendarEvent) => {
        if (mode !== 'diff' || event.diffKind !== 'uncovered') return
        if (!event.taskId || !event.intervalId) return
        // A future gap can't yet have been missed -- only a fully-past
        // uncovered segment is explainable (v03 item 9).
        if (!isFullyPast(event, now)) return
        onExplainGap?.({
          taskId: event.taskId,
          intervalId: event.intervalId,
          start: event.start,
          end: event.end,
        })
      }}
      eventPropGetter={(event: CalendarEvent) => {
        if (event.kind === 'real') {
          return { style: { ...chipFillStyle(event.colors), border: 'none' } }
        }
        const isUncoveredGap = event.diffKind === 'uncovered' && isFullyPast(event, now)
        return {
          style: {
            backgroundColor: 'transparent',
            border: `1px dashed ${primaryChipColor(event.colors)}`,
            color: primaryChipColor(event.colors),
            cursor: isUncoveredGap ? 'pointer' : undefined,
            fontWeight: isUncoveredGap ? 600 : undefined,
            boxShadow: isUncoveredGap ? `inset 0 0 0 1px ${primaryChipColor(event.colors)}` : undefined,
          },
        }
      }}
      components={{
        header: CalendarDayHeader,
        timeGutterHeader: CalendarTimezoneLabel,
        event: ({ event }: { event: CalendarEvent }) => (
          <span data-testid={`event-${event.diffKind ?? event.kind}`}>{event.title}</span>
        ),
      }}
      style={{ height: '100%' }}
    />
  )
}
