import { useEffect, useMemo, useState } from 'react'
import { Calendar } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar-dark.css'
import type { Task } from '../../types'
import { useEntriesForWeek } from '../../api/timer'
import { useIntervalsForWeek } from '../../api/intervals'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../../lib/week'
import { localizer } from '../../lib/calendarLocalizer'
import { COLOR_HEX } from '../tree/colors'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color: string
  kind: 'actual' | 'planned'
}

export default function ExecuteCalendar({ tasksById }: { tasksById: Map<string, Task> }) {
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(new Date()))
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(new Date())

  const { data: entries = [] } = useEntriesForWeek(weekStart)
  const { data: intervals = [] } = useIntervalsForWeek(weekStart)

  const events = useMemo<CalendarEvent[]>(() => {
    const actual: CalendarEvent[] = entries.map((entry) => {
      const task = tasksById.get(entry.task_id)
      const color = task?.effective_colors[0]
      return {
        id: `entry-${entry.id}`,
        title: task?.name ?? 'Unknown task',
        start: new Date(entry.start),
        end: entry.end ? new Date(entry.end) : now,
        color: color ? COLOR_HEX[color] : '#525252',
        kind: 'actual',
      }
    })

    const planned: CalendarEvent[] = intervals
      .filter((interval) => new Date(interval.start) >= now)
      .map((interval) => {
        const task = tasksById.get(interval.task_id)
        const color = task?.effective_colors[0]
        return {
          id: `interval-${interval.id}`,
          title: task?.name ?? 'Unknown task',
          start: new Date(interval.start),
          end: new Date(interval.end),
          color: color ? COLOR_HEX[color] : '#525252',
          kind: 'planned',
        }
      })

    return [...actual, ...planned]
  }, [entries, intervals, tasksById, now])

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isCurrentWeek}
            onClick={() => setWeekAnchor((prev) => shiftWeek(prev, -1))}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor((prev) => shiftWeek(prev, 1))}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Next →
          </button>
          <span className="text-sm text-neutral-300">
            Week of {formatWeekLabel(weekAnchor)}
            {isCurrentWeek && <span className="ml-1 text-neutral-500">(current)</span>}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neutral-400" /> Actual
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded border border-neutral-400" /> Planned
          </span>
        </div>
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
            style:
              event.kind === 'actual'
                ? { backgroundColor: event.color, border: 'none' }
                : {
                    backgroundColor: 'transparent',
                    border: `1px dashed ${event.color}`,
                    color: event.color,
                  },
          })}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
