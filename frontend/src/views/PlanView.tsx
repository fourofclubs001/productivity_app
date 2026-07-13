import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useTasks } from '../api/tasks'
import TaskTree from '../components/tree/TaskTree'
import TaskDetailPanel from '../components/tree/TaskDetailPanel'
import NewTaskDialog from '../components/tree/NewTaskDialog'
import PlanCalendar from '../components/calendar/PlanCalendar'

export default function PlanView() {
  const { data: tasks, isLoading, isError, error } = useTasks()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogParentId, setDialogParentId] = useState<string | null>()

  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks])
  const selectedTask = selectedId ? tasksById.get(selectedId) : undefined

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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
    <DndContext sensors={sensors}>
      <div className="flex h-[calc(100vh-49px)]">
        <div className="w-56 shrink-0 border-r border-border">
          <TaskTree
            tasks={tasks ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenNewTask={setDialogParentId}
          />
        </div>
        <div className="w-72 shrink-0 border-r border-border">
          {selectedTask ? (
            <TaskDetailPanel
              task={selectedTask}
              tasksById={tasksById}
              onAddChild={setDialogParentId}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">
              Select a task to see its details
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <PlanCalendar tasksById={tasksById} />
        </div>
        {dialogParentId !== undefined && (
          <NewTaskDialog
            parentId={dialogParentId}
            onClose={() => setDialogParentId(undefined)}
            onCreated={(task) => {
              setSelectedId(task.id)
              setDialogParentId(undefined)
            }}
          />
        )}
      </div>
    </DndContext>
  )
}
