import { useMemo, useRef, useState } from 'react'
import { Calendar } from 'react-big-calendar'
import dragAndDropImport, {
  type EventInteractionArgs,
} from 'react-big-calendar/lib/addons/dragAndDrop'
import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import './calendar.css'
import type { Interval, Task } from '../../types'
import {
  useCreateInterval,
  useDeleteInterval,
  useIntervalsForWeek,
  useUpdateInterval,
} from '../../api/intervals'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../../lib/week'
import { localizer } from '../../lib/calendarLocalizer'
import { utcNow } from '../../lib/time'
import { resolveDropSlot, slotToInterval } from '../../lib/calendarGeometry'
import { useUndo } from '../../undo/UndoProvider'
import { chipFillStyle } from './eventColor'
import CalendarDayHeader from './CalendarDayHeader'
import CalendarTimezoneLabel from './CalendarTimezoneLabel'
import ContextMenu from './ContextMenu'
import AlertDialog from '../common/AlertDialog'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  colors: string[]
}

// Vite's dev-server esbuild pre-bundling double-wraps this addon's default
// export (mod.default.default) for reasons specific to its CJS/ESM interop
// shape; vitest and the production Rollup build both resolve it correctly as
// a plain function. Unwrap defensively so both environments work.
const withDragAndDrop =
  typeof dragAndDropImport === 'function'
    ? dragAndDropImport
    : (dragAndDropImport as unknown as { default: typeof dragAndDropImport }).default

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar)

export default function PlanCalendar({
  tasksById,
  onOpenTask,
}: {
  tasksById: Map<string, Task>
  onOpenTask: (taskId: string) => void
}) {
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(utcNow()))
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
  const updateInterval = useUpdateInterval()
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

  function handleEventChange({ event, start, end }: EventInteractionArgs<CalendarEvent>) {
    const interval = intervals.find((i) => i.id === event.id)
    if (!interval) return
    const previousStart = interval.start
    const previousEnd = interval.end
    const input = { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
    setScheduleError(null)
    updateInterval.mutate(
      { id: interval.id, input },
      {
        onSuccess: () =>
          pushUndo({
            label: 'Move/resize scheduled task',
            undo: () =>
              updateInterval.mutateAsync({
                id: interval.id,
                input: { start: previousStart, end: previousEnd },
              }),
          }),
        onError: (error) => setScheduleError((error as Error).message),
      },
    )
  }

  const events = useMemo<CalendarEvent[]>(
    () =>
      intervals.map((interval) => {
        const task = tasksById.get(interval.task_id)
        return {
          id: interval.id,
          title: task?.name ?? 'Unknown task',
          start: new Date(interval.start),
          end: new Date(interval.end),
          colors: task?.effective_colors ?? [],
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
        <AlertDialog message={scheduleError} onClose={() => setScheduleError(null)} />
      )}

      <div
        ref={setCalendarRef}
        className={`min-h-0 flex-1 ${isOver ? 'ring-2 ring-accent' : ''}`}
      >
        <DnDCalendar
          localizer={localizer}
          events={events}
          defaultView="week"
          views={['week']}
          date={weekAnchor}
          onNavigate={() => {}}
          toolbar={false}
          selectable={false}
          resizable
          onEventDrop={handleEventChange}
          onEventResize={handleEventChange}
          onSelectEvent={(event: CalendarEvent) => {
            const interval = intervals.find((i) => i.id === event.id)
            if (interval) onOpenTask(interval.task_id)
          }}
          eventPropGetter={(event: CalendarEvent) => ({
            style: { ...chipFillStyle(event.colors), border: 'none' },
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
    </div>
  )
}
