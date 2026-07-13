import { useMemo } from 'react'
import { Calendar } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import type { Entry, Interval, Task } from '../../types'
import { localizer } from '../../lib/calendarLocalizer'
import { COLOR_HEX } from '../tree/colors'
import CalendarDayHeader from './CalendarDayHeader'
import CalendarTimezoneLabel from './CalendarTimezoneLabel'

export type EvaluateMode = 'planned' | 'real' | 'diff'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color: string
  kind: 'planned' | 'real'
}

export default function EvaluateCalendar({
  mode,
  weekAnchor,
  intervals,
  entries,
  tasksById,
}: {
  mode: EvaluateMode
  weekAnchor: Date
  intervals: Interval[]
  entries: Entry[]
  tasksById: Map<string, Task>
}) {
  const events = useMemo<CalendarEvent[]>(() => {
    const planned: CalendarEvent[] = intervals.map((interval) => {
      const task = tasksById.get(interval.task_id)
      const color = task?.effective_colors[0]
      return {
        id: `interval-${interval.id}`,
        title: task?.name ?? 'Unknown task',
        start: new Date(interval.start),
        end: new Date(interval.end),
        color: color ? COLOR_HEX[color] : '#616161',
        kind: 'planned',
      }
    })

    const real: CalendarEvent[] = entries.map((entry) => {
      const task = tasksById.get(entry.task_id)
      const color = task?.effective_colors[0]
      return {
        id: `entry-${entry.id}`,
        title: task?.name ?? 'Unknown task',
        start: new Date(entry.start),
        end: entry.end ? new Date(entry.end) : new Date(),
        color: color ? COLOR_HEX[color] : '#616161',
        kind: 'real',
      }
    })

    if (mode === 'planned') return planned
    if (mode === 'real') return real
    return [...planned, ...real]
  }, [mode, intervals, entries, tasksById])

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
      eventPropGetter={(event: CalendarEvent) => ({
        style:
          event.kind === 'real'
            ? { backgroundColor: event.color, border: 'none' }
            : {
                backgroundColor: 'transparent',
                border: `1px dashed ${event.color}`,
                color: event.color,
              },
      })}
      components={{ header: CalendarDayHeader, timeGutterHeader: CalendarTimezoneLabel }}
      style={{ height: '100%' }}
    />
  )
}
