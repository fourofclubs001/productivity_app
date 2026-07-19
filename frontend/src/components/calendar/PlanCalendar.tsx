import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  resolveDropSlot,
  slotToInterval,
  slotToPixelRect,
  type GridGeometry,
  type PixelRect,
} from '../../lib/calendarGeometry'
import { isFullyPast, isInProgress, resolveDragRescheduleAction } from '../../lib/intervalTiming'
import {
  makeCreateIntervalEntry,
  makeDeleteIntervalEntry,
  makeUpdateTimeEntry,
} from '../../lib/intervalUndoEntries'
import { useUndo } from '../../undo/UndoProvider'
import { chipFillStyle } from './eventColor'
import CalendarDayHeader from './CalendarDayHeader'
import CalendarTimezoneLabel from './CalendarTimezoneLabel'
import ContextMenu from './ContextMenu'
import AlertDialog from '../common/AlertDialog'
import EditIntervalTimeModal from './EditIntervalTimeModal'

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
  const [editingInterval, setEditingInterval] = useState<Interval | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [dragPreview, setDragPreview] = useState<{ rect: PixelRect; task: Task } | null>(null)
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null)
  const dragCandidateRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(utcNow())

  const { data: intervals = [] } = useIntervalsForWeek(weekStart)
  const createInterval = useCreateInterval()
  const updateInterval = useUpdateInterval()
  const deleteInterval = useDeleteInterval()
  const { pushUndo } = useUndo()

  // withDragAndDrop's own reschedule-drag (as opposed to the dnd-kit drag
  // from the left tree panel, handled separately below) fires its onMouseDown
  // handler on every press of a draggable chip -- including a plain click,
  // not just an actual drag -- so it can't be used to detect "really
  // dragging." Instead, track mousedown-then-movement-past-a-threshold
  // ourselves (mirroring how the library's own Selection helper distinguishes
  // a click from a drag) via a data-interval-id attribute on the custom event
  // renderer below. No onDragEnd/onDragCancel exists either, so this is
  // cleared defensively on mouseup/Escape too, not just on a successful drop.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const MOVE_THRESHOLD_PX = 5

    function onMouseDown(domEvent: MouseEvent) {
      const eventEl = (domEvent.target as HTMLElement).closest<HTMLElement>('[data-interval-id]')
      if (!eventEl) return
      dragCandidateRef.current = {
        id: eventEl.dataset.intervalId!,
        x: domEvent.clientX,
        y: domEvent.clientY,
      }
    }

    function onMouseMove(domEvent: MouseEvent) {
      const candidate = dragCandidateRef.current
      if (!candidate) return
      const dx = domEvent.clientX - candidate.x
      const dy = domEvent.clientY - candidate.y
      if (Math.hypot(dx, dy) <= MOVE_THRESHOLD_PX) return
      dragCandidateRef.current = null
      const interval = intervals.find((i) => i.id === candidate.id)
      if (!interval) return
      if (isFullyPast({ start: new Date(interval.start), end: new Date(interval.end) }, now)) return
      setDraggingEventId(candidate.id)
    }

    function clear() {
      dragCandidateRef.current = null
      setDraggingEventId(null)
    }
    function onKeyDown(domEvent: KeyboardEvent) {
      if (domEvent.key === 'Escape') clear()
    }

    wrapper.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', clear)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      wrapper.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', clear)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [intervals, now])

  const { setNodeRef, isOver } = useDroppable({ id: 'plan-calendar' })
  function setCalendarRef(node: HTMLDivElement | null) {
    wrapperRef.current = node
    setNodeRef(node)
  }

  const intervalMutators = {
    createIntervalAsync: createInterval.mutateAsync,
    deleteIntervalAsync: deleteInterval.mutateAsync,
  }

  function resolveGrid(): { grid: GridGeometry; dayCount: number } | null {
    const daySlots = wrapperRef.current?.querySelectorAll<HTMLElement>('.rbc-day-slot')
    if (!daySlots || daySlots.length === 0) return null
    const first = daySlots[0].getBoundingClientRect()
    const last = daySlots[daySlots.length - 1].getBoundingClientRect()
    return {
      grid: {
        left: first.left,
        top: first.top,
        width: last.right - first.left,
        height: first.height,
        scrollTop: 0,
      },
      dayCount: daySlots.length,
    }
  }

  useDndMonitor({
    onDragMove: (event) => {
      const { active, over } = event
      if (over?.id !== 'plan-calendar') {
        setDragPreview(null)
        return
      }
      const task = tasksById.get(String(active.id))
      if (!task || !task.is_leaf) {
        setDragPreview(null)
        return
      }

      const resolved = resolveGrid()
      if (!resolved) return
      const activatorEvent = event.activatorEvent as PointerEvent
      const point = {
        clientX: activatorEvent.clientX + event.delta.x,
        clientY: activatorEvent.clientY + event.delta.y,
      }
      const slot = resolveDropSlot(point, resolved.grid, resolved.dayCount)
      if (!slot) {
        setDragPreview(null)
        return
      }
      setDragPreview({
        rect: slotToPixelRect(slot, resolved.grid, resolved.dayCount),
        task,
      })
    },
    onDragEnd: (event) => {
      setDragPreview(null)
      const { active, over } = event
      if (over?.id !== 'plan-calendar') return
      const task = tasksById.get(String(active.id))
      if (!task || !task.is_leaf) return

      const resolved = resolveGrid()
      if (!resolved) return

      const activatorEvent = event.activatorEvent as PointerEvent
      const dropPoint = {
        clientX: activatorEvent.clientX + event.delta.x,
        clientY: activatorEvent.clientY + event.delta.y,
      }
      const slot = resolveDropSlot(dropPoint, resolved.grid, resolved.dayCount)
      if (!slot) return

      const { start, end } = slotToInterval(slot, weekAnchor)
      setScheduleError(null)
      createInterval.mutate(
        { task_id: task.id, start: start.toISOString(), end: end.toISOString() },
        {
          onSuccess: (created) => pushUndo(makeDeleteIntervalEntry(created, intervalMutators)),
          onError: (error) => setScheduleError((error as Error).message),
        },
      )
    },
    onDragCancel: () => setDragPreview(null),
  })

  function deleteIntervalWithUndo(interval: Interval) {
    const range = { start: new Date(interval.start), end: new Date(interval.end) }
    if (isFullyPast(range, now) || isInProgress(range, now)) {
      setScheduleError(
        'This time slot has already started or ended and can no longer be deleted',
      )
      return
    }
    deleteInterval.mutate(interval.id, {
      onSuccess: () => pushUndo(makeCreateIntervalEntry(interval, intervalMutators)),
      onError: (error) => setScheduleError((error as Error).message),
    })
  }

  function handleEventChange({ event, start, end }: EventInteractionArgs<CalendarEvent>) {
    setDraggingEventId(null)
    const interval = intervals.find((i) => i.id === event.id)
    if (!interval) return
    const previousStart = interval.start
    const previousEnd = interval.end
    const previousRange = { start: new Date(previousStart), end: new Date(previousEnd) }
    const newStart = new Date(start)
    const newEnd = new Date(end)

    const action = resolveDragRescheduleAction(previousRange, newStart, now)
    if (action.type === 'reject') {
      setScheduleError(action.message)
      return
    }
    if (action.type === 'create') {
      setScheduleError(null)
      createInterval.mutate(
        { task_id: interval.task_id, start: newStart.toISOString(), end: newEnd.toISOString() },
        {
          onSuccess: (created) => pushUndo(makeDeleteIntervalEntry(created, intervalMutators)),
          onError: (error) => setScheduleError((error as Error).message),
        },
      )
      return
    }

    const input = { start: newStart.toISOString(), end: newEnd.toISOString() }
    setScheduleError(null)
    updateInterval.mutate(
      { id: interval.id, input },
      {
        onSuccess: () =>
          pushUndo(
            makeUpdateTimeEntry(
              interval.id,
              { start: previousStart, end: previousEnd },
              input,
              updateInterval.mutateAsync,
            ),
          ),
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
          title: interval.task_name ?? task?.name ?? 'Unknown task',
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
          draggableAccessor={() => true}
          resizableAccessor={(event: CalendarEvent) => !isFullyPast(event, now)}
          onEventDrop={handleEventChange}
          onEventResize={handleEventChange}
          onSelectEvent={(event: CalendarEvent) => {
            const interval = intervals.find((i) => i.id === event.id)
            if (interval) onOpenTask(interval.task_id)
          }}
          eventPropGetter={(event: CalendarEvent) => ({
            style: {
              ...chipFillStyle(event.colors),
              border: 'none',
              opacity: event.id === draggingEventId ? 0 : isFullyPast(event, now) ? 0.55 : 1,
            },
          })}
          components={{
            header: CalendarDayHeader,
            timeGutterHeader: CalendarTimezoneLabel,
            event: ({ event, title }: { event: CalendarEvent; title: string }) => (
              <div
                className="h-full w-full truncate"
                data-interval-id={event.id}
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

      {dragPreview && (
        <div
          data-testid="drag-preview-chip"
          className="pointer-events-none fixed z-40 truncate rounded px-1 text-xs text-white"
          style={{
            left: dragPreview.rect.left,
            top: dragPreview.rect.top,
            width: dragPreview.rect.width,
            height: dragPreview.rect.height,
            ...chipFillStyle(dragPreview.task.effective_colors),
            opacity: 0.7,
          }}
        >
          {dragPreview.task.name}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Edit time',
              onSelect: () => setEditingInterval(contextMenu.interval),
            },
            {
              label: 'Delete',
              danger: true,
              onSelect: () => deleteIntervalWithUndo(contextMenu.interval),
            },
          ]}
        />
      )}

      {editingInterval && (
        <EditIntervalTimeModal
          interval={editingInterval}
          onClose={() => setEditingInterval(null)}
        />
      )}
    </div>
  )
}
