import { useMemo, useState } from 'react'
import { Calendar, type SlotInfo } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import type { Interval, Task } from '../../types'
import { useCreateInterval, useDeleteInterval, useIntervalsForWeek } from '../../api/intervals'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../../lib/week'
import { localizer } from '../../lib/calendarLocalizer'
import { utcNow } from '../../lib/time'
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

export default function PlanCalendar({
  selectedTask,
  tasksById,
}: {
  selectedTask: Task | undefined
  tasksById: Map<string, Task>
}) {
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(utcNow()))
  const [pendingDelete, setPendingDelete] = useState<Interval | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    interval: Interval
  } | null>(null)

  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(utcNow())

  const { data: intervals = [] } = useIntervalsForWeek(weekStart)
  const createInterval = useCreateInterval()
  const deleteInterval = useDeleteInterval()
  const { pushUndo } = useUndo()

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

  const canSchedule = Boolean(selectedTask?.is_leaf)

  function handleSelectSlot(slot: SlotInfo) {
    if (!selectedTask || !selectedTask.is_leaf) return
    createInterval.mutate({
      task_id: selectedTask.id,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    })
  }

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
        {!canSchedule && (
          <span className="text-xs text-text-secondary">
            Select a leaf task to reserve time for it
          </span>
        )}
        {canSchedule && (
          <span className="text-xs text-text-secondary">
            Drag on the calendar to schedule <strong>{selectedTask?.name}</strong>
          </span>
        )}
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
          selectable={canSchedule}
          onSelectSlot={handleSelectSlot}
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
