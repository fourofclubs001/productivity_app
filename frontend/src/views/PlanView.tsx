import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useTasks } from '../api/tasks'
import TaskTree from '../components/tree/TaskTree'
import RecurrentTasksList from '../components/tree/RecurrentTasksList'
import TaskDetailPanel from '../components/tree/TaskDetailPanel'
import NewTaskDialog from '../components/tree/NewTaskDialog'
import NewRecurrentTaskDialog from '../components/tree/NewRecurrentTaskDialog'
import NewRecurrentGroupDialog from '../components/tree/NewRecurrentGroupDialog'
import NewRecurrentItemChooserDialog from '../components/tree/NewRecurrentItemChooserDialog'
import PlanCalendar from '../components/calendar/PlanCalendar'
import Button from '../components/common/Button'
import { Plus } from '../components/common/icons'
import { useResizableWidth } from '../lib/useResizableWidth'

type LeftTab = 'tasks' | 'recurrent-tasks'

export default function PlanView() {
  const { data: tasks, isLoading, isError, error } = useTasks()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogParentId, setDialogParentId] = useState<string | null>()
  const [leftTab, setLeftTab] = useState<LeftTab>('tasks')
  const [showNewRecurrentTask, setShowNewRecurrentTask] = useState(false)
  const [showRecurrentChooser, setShowRecurrentChooser] = useState(false)
  const [showNewRecurrentGroup, setShowNewRecurrentGroup] = useState(false)

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
      <div className="flex h-full">
        <div
          className="relative flex shrink-0 flex-col border-r border-border"
          style={{ width: treePanel.width }}
        >
          <div className="flex items-center border-b border-border pr-1">
            <div className="flex flex-1">
              {(
                [
                  ['tasks', 'Tasks'],
                  ['recurrent-tasks', 'Recurrent tasks'],
                ] as [LeftTab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLeftTab(key)}
                  className={`px-2 py-2 text-xs font-medium transition-colors ${
                    leftTab === key
                      ? 'border-b-2 border-accent text-accent'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="icon"
              size="sm"
              title={leftTab === 'tasks' ? 'New task' : 'New recurrent item'}
              aria-label={leftTab === 'tasks' ? 'New task' : 'New recurrent item'}
              onClick={() =>
                leftTab === 'tasks' ? setDialogParentId(null) : setShowRecurrentChooser(true)
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
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
              <RecurrentTasksList
                tasks={tasks ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
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
        {showRecurrentChooser && (
          <NewRecurrentItemChooserDialog
            onClose={() => setShowRecurrentChooser(false)}
            onChooseTask={() => {
              setShowRecurrentChooser(false)
              setShowNewRecurrentTask(true)
            }}
            onChooseGroup={() => {
              setShowRecurrentChooser(false)
              setShowNewRecurrentGroup(true)
            }}
          />
        )}
        {showNewRecurrentTask && (
          <NewRecurrentTaskDialog
            onClose={() => setShowNewRecurrentTask(false)}
            onCreated={(task) => {
              setSelectedId(task.id)
              setShowNewRecurrentTask(false)
            }}
          />
        )}
        {showNewRecurrentGroup && (
          <NewRecurrentGroupDialog
            onClose={() => setShowNewRecurrentGroup(false)}
            onCreated={() => setShowNewRecurrentGroup(false)}
          />
        )}
      </div>
    </DndContext>
  )
}
