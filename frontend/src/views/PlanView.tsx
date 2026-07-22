import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useTasks } from '../api/tasks'
import TaskTree from '../components/tree/TaskTree'
import RoutinesList from '../components/tree/RoutinesList'
import TaskDetailPanel from '../components/tree/TaskDetailPanel'
import NewTaskDialog from '../components/tree/NewTaskDialog'
import NewRoutineDialog from '../components/tree/NewRoutineDialog'
import PlanCalendar from '../components/calendar/PlanCalendar'
import { useResizableWidth } from '../lib/useResizableWidth'

type LeftTab = 'tasks' | 'routines'

export default function PlanView() {
  const { data: tasks, isLoading, isError, error } = useTasks()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogParentId, setDialogParentId] = useState<string | null>()
  const [leftTab, setLeftTab] = useState<LeftTab>('tasks')
  const [showNewRoutine, setShowNewRoutine] = useState(false)

  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks])
  const selectedTask = selectedId ? tasksById.get(selectedId) : undefined

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const treePanel = useResizableWidth('plan.treeWidth', 224, 160, 480)
  const detailPanel = useResizableWidth('plan.detailWidth', 288, 200, 600)

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
        <div
          className="relative flex shrink-0 flex-col border-r border-border"
          style={{ width: treePanel.width }}
        >
          <div className="flex border-b border-border">
            {(
              [
                ['tasks', 'Tasks'],
                ['routines', 'Routines'],
              ] as [LeftTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLeftTab(key)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                  leftTab === key
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {leftTab === 'tasks' ? (
              <TaskTree
                tasks={tasks ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onOpenNewTask={setDialogParentId}
              />
            ) : (
              <RoutinesList
                tasks={tasks ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onOpenNewRoutine={() => setShowNewRoutine(true)}
              />
            )}
          </div>
          <div
            onMouseDown={treePanel.startResize}
            title="Drag to resize"
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/50"
          />
        </div>
        <div
          className="relative shrink-0 border-r border-border"
          style={{ width: detailPanel.width }}
        >
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
          <div
            onMouseDown={detailPanel.startResize}
            title="Drag to resize"
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/50"
          />
        </div>
        <div className="min-w-0 flex-1">
          <PlanCalendar tasksById={tasksById} onOpenTask={setSelectedId} />
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
        {showNewRoutine && (
          <NewRoutineDialog
            onClose={() => setShowNewRoutine(false)}
            onCreated={(task) => {
              setSelectedId(task.id)
              setShowNewRoutine(false)
            }}
          />
        )}
      </div>
    </DndContext>
  )
}
