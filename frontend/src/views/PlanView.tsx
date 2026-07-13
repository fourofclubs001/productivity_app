import { useMemo, useState } from 'react'
import { useTasks } from '../api/tasks'
import TaskTree from '../components/tree/TaskTree'
import TaskDetailPanel from '../components/tree/TaskDetailPanel'
import PlanCalendar from '../components/calendar/PlanCalendar'

export default function PlanView() {
  const { data: tasks, isLoading, isError, error } = useTasks()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks])
  const selectedTask = selectedId ? tasksById.get(selectedId) : undefined

  if (isLoading) {
    return <div className="p-6 text-sm text-text-secondary">Loading tasks…</div>
  }

  if (isError) {
    return (
      <div className="p-6 text-sm text-danger">
        Failed to load tasks: {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <div className="w-56 shrink-0 border-r border-border">
        <TaskTree tasks={tasks ?? []} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="w-72 shrink-0 border-r border-border">
        {selectedTask ? (
          <TaskDetailPanel task={selectedTask} tasksById={tasksById} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-secondary">
            Select a task to see its details
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <PlanCalendar selectedTask={selectedTask} tasksById={tasksById} />
      </div>
    </div>
  )
}
