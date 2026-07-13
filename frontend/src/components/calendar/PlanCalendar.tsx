import { useMemo, useRef, useState } from 'react'
import { Calendar } from 'react-big-calendar'
import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import type { Interval, Task } from '../../types'
import { useCreateInterval, useDeleteInterval, useIntervalsForWeek } from '../../api/intervals'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../../lib/week'
import { localizer } from '../../lib/calendarLocalizer'
import { utcNow } from '../../lib/time'
import { resolveDropSlot, slotToInterval } from '../../lib/calendarGeometry'
import { useUndo } from '../../undo/UndoProvider'
import { COLOR_HEX } from '../tree/colors'
import CalendarDayHeader from './CalendarDayHeader'
import CalendarTimezoneLabel from './CalendarTimezoneLabel'
import ContextMenu from './ContextMenu'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color: string
}

export default function PlanCalendar({ tasksById }: { tasksById: Map<string, Task> }) {
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(utcNow()))
  const [pendingDelete, setPendingDelete] = useState<Interval | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    interval: Interval
  } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(utcNow())

  const { data: intervals = [] } = useIntervalsForWeek(weekStart)
  const createInterval = useCreateInterval()
  const deleteInterval = useDeleteInterval()
  const { pushUndo } = useUndo()

  const { setNodeRef, isOver } = useDroppable({ id: 'plan-calendar' })
  function setCalendarRef(node: HTMLDivElement | null) {
    wrapperRef.current = node
    setNodeRef(node)
  }

  useDndMonitor({
    onDragEnd: (event) => {
      const { active, over } = event
      if (over?.id !== 'plan-calendar') return
      const task = tasksById.get(String(active.id))
      if (!task || !task.is_leaf) return

      const daySlots = wrapperRef.current?.querySelectorAll<HTMLElement>('.rbc-day-slot')
      if (!daySlots || daySlots.length === 0) return
      const first = daySlots[0].getBoundingClientRect()
      const last = daySlots[daySlots.length - 1].getBoundingClientRect()

      const activatorEvent = event.activatorEvent as PointerEvent
      const dropPoint = {
        clientX: activatorEvent.clientX + event.delta.x,
        clientY: activatorEvent.clientY + event.delta.y,
      }
      const slot = resolveDropSlot(
        dropPoint,
        {
          left: first.left,
          top: first.top,
          width: last.right - first.left,
          height: first.height,
          scrollTop: 0,
        },
        daySlots.length,
      )
      if (!slot) return

      const { start, end } = slotToInterval(slot, weekAnchor)
      setScheduleError(null)
      createInterval.mutate(
        { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
        { onError: (error) => setScheduleError((error as Error).message) },
      )
    },
  })

  function deleteIntervalWithUndo(interval: Interval) {
    deleteInterval.mutate(interval.id, {
      onSuccess: () =>
        pushUndo({
          label: 'Delete reserved time slot',
          undo: () =>
            createInterval.mutateAsync({
              task_id: interval.task_id,
              start: interval.start,
              end: interval.end,
            }),
        }),
    })
  }

  const events = useMemo<CalendarEvent[]>(
    () =>
      intervals.map((interval) => {
        const task = tasksById.get(interval.task_id)
        const color = task?.effective_colors[0]
        return {
          id: interval.id,
          title: task?.name ?? 'Unknown task',
          start: new Date(interval.start),
          end: new Date(interval.end),
          color: color ? COLOR_HEX[color] : '#616161',
        }
      }),
    [intervals, tasksById],
  )

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
        <span className="text-xs text-text-secondary">Drag a task here to schedule it</span>
      </div>

      {scheduleError && (
        <div className="mb-2 flex items-center justify-between rounded border border-danger bg-danger/10 px-3 py-2 text-xs text-danger">
          <span>{scheduleError}</span>
          <button type="button" onClick={() => setScheduleError(null)} className="ml-2">
            ×
          </button>
        </div>
      )}

      <div
        ref={setCalendarRef}
        className={`min-h-0 flex-1 ${isOver ? 'ring-2 ring-accent' : ''}`}
      >
        <Calendar
          localizer={localizer}
          events={events}
          defaultView="week"
          views={['week']}
          date={weekAnchor}
          onNavigate={() => {}}
          toolbar={false}
          selectable={false}
          onSelectEvent={(event) => {
            const interval = intervals.find((i) => i.id === event.id)
            if (interval) setPendingDelete(interval)
          }}
          eventPropGetter={(event: CalendarEvent) => ({
            style: { backgroundColor: event.color, border: 'none' },
          })}
          components={{
            header: CalendarDayHeader,
            timeGutterHeader: CalendarTimezoneLabel,
            event: ({ event, title }: { event: CalendarEvent; title: string }) => (
              <div
                className="h-full w-full truncate"
                onContextMenu={(domEvent) => {
                  domEvent.preventDefault()
                  const interval = intervals.find((i) => i.id === event.id)
                  if (!interval) return
                  setContextMenu({ x: domEvent.clientX, y: domEvent.clientY, interval })
                }}
              >
                {title}
              </div>
            ),
          }}
          style={{ height: '100%' }}
        />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Delete',
              danger: true,
              onSelect: () => deleteIntervalWithUndo(contextMenu.interval),
            },
          ]}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg border border-border bg-surface p-4 shadow-xl">
            <p className="mb-3 text-sm text-text-primary">
              Remove this reserved time slot for{' '}
              <strong>{tasksById.get(pendingDelete.task_id)?.name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteIntervalWithUndo(pendingDelete)
                  setPendingDelete(null)
                }}
                className="rounded bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger-hover"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
