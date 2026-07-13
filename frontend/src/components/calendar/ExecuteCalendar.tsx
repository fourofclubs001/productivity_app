import { useEffect, useMemo, useState } from 'react'
import { Calendar } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import type { Task } from '../../types'
import { useEntriesForWeek } from '../../api/timer'
import { useIntervalsForWeek } from '../../api/intervals'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../../lib/week'
import { localizer } from '../../lib/calendarLocalizer'
import { utcNow } from '../../lib/time'
import { chipFillStyle } from './eventColor'
import CalendarDayHeader from './CalendarDayHeader'
import CalendarTimezoneLabel from './CalendarTimezoneLabel'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  colors: string[]
}

export default function ExecuteCalendar({ tasksById }: { tasksById: Map<string, Task> }) {
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(utcNow()))
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(utcNow())

  const { data: entries = [] } = useEntriesForWeek(weekStart)
  const { data: intervals = [] } = useIntervalsForWeek(weekStart)

  const events = useMemo<CalendarEvent[]>(() => {
    const actual: CalendarEvent[] = entries.map((entry) => {
      const task = tasksById.get(entry.task_id)
      return {
        id: `entry-${entry.id}`,
        title: task?.name ?? 'Unknown task',
        start: new Date(entry.start),
        end: entry.end ? new Date(entry.end) : now,
        colors: task?.effective_colors ?? [],
      }
    })

    const planned: CalendarEvent[] = intervals
      .filter((interval) => new Date(interval.start) >= now)
      .map((interval) => {
        const task = tasksById.get(interval.task_id)
        return {
          id: `interval-${interval.id}`,
          title: task?.name ?? 'Unknown task',
          start: new Date(interval.start),
          end: new Date(interval.end),
          colors: task?.effective_colors ?? [],
        }
      })

    return [...actual, ...planned]
  }, [entries, intervals, tasksById, now])

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isCurrentWeek}
          onClick={() => setWeekAnchor((prev) => shiftWeek(prev, -1))}
          className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => setWeekAnchor((prev) => shiftWeek(prev, 1))}
          className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover"
        >
          Next →
        </button>
        <span className="text-sm text-text-secondary">
          Week of {formatWeekLabel(weekAnchor)}
          {isCurrentWeek && <span className="ml-1 text-text-secondary">(current)</span>}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <Calendar
          localizer={localizer}
          events={events}
          defaultView="week"
          views={['week']}
          date={weekAnchor}
          onNavigate={() => {}}
          toolbar={false}
          selectable={false}
          eventPropGetter={(event: CalendarEvent) => ({
            style: {
              ...chipFillStyle(event.colors),
              border: 'none',
              opacity: event.end <= now ? 0.55 : 1,
            },
          })}
          components={{ header: CalendarDayHeader, timeGutterHeader: CalendarTimezoneLabel }}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
