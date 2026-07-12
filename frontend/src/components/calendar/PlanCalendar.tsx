import { useMemo, useState } from 'react'
import { Calendar, type SlotInfo } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar-dark.css'
import type { Interval, Task } from '../../types'
import { useCreateInterval, useDeleteInterval, useIntervalsForWeek } from '../../api/intervals'
import { formatWeekLabel, mondayOf, shiftWeek, weekStartKey } from '../../lib/week'
import { localizer } from '../../lib/calendarLocalizer'
import { COLOR_HEX } from '../tree/colors'

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
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOf(new Date()))
  const [pendingDelete, setPendingDelete] = useState<Interval | null>(null)

  const weekStart = weekStartKey(weekAnchor)
  const isCurrentWeek = weekStart === weekStartKey(new Date())

  const { data: intervals = [] } = useIntervalsForWeek(weekStart)
  const createInterval = useCreateInterval()
  const deleteInterval = useDeleteInterval()

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
          color: color ? COLOR_HEX[color] : '#525252',
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
        {!canSchedule && (
          <span className="text-xs text-neutral-500">
            Select a leaf task to reserve time for it
          </span>
        )}
        {canSchedule && (
          <span className="text-xs text-neutral-500">
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
          style={{ height: '100%' }}
        />
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-md border border-neutral-700 bg-neutral-900 p-4 shadow-xl">
            <p className="mb-3 text-sm text-neutral-200">
              Remove this reserved time slot for{' '}
              <strong>{tasksById.get(pendingDelete.task_id)?.name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteInterval.mutate(pendingDelete.id)
                  setPendingDelete(null)
                }}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
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
