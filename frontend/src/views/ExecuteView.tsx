import { useMemo } from 'react'
import { useTasks } from '../api/tasks'
import TimerControl from '../components/timer/TimerControl'
import ExecuteCalendar from '../components/calendar/ExecuteCalendar'

export default function ExecuteView() {
  const { data: tasks, isLoading, isError, error } = useTasks()
  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks])

  if (isLoading) {
    return <div className="p-6 text-sm text-neutral-500">Loading tasks…</div>
  }

  if (isError) {
    return (
      <div className="p-6 text-sm text-red-400">
        Failed to load tasks: {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      <TimerControl tasks={tasks ?? []} />
      <div className="min-h-0 flex-1">
        <ExecuteCalendar tasksById={tasksById} />
      </div>
    </div>
  )
}
