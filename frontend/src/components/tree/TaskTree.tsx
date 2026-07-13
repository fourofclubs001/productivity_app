import { useMemo, useState } from 'react'
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import type { Task } from '../../types'
import TaskTreeNode from './TaskTreeNode'
import { isHiddenFromPlan, rootIds as computeRootIds, resolveDropAction } from '../../lib/taskTree'
import { useAddParent, useRemoveParent, useReorderTask } from '../../api/tasks'
import { useUndo } from '../../undo/UndoProvider'
import { useParentDismissal } from '../../lib/useParentDismissal'

export default function TaskTree({
  tasks,
  selectedId,
  onSelect,
  onOpenNewTask,
}: {
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenNewTask: (parentId: string | null) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { decisions, decide, undecide } = useParentDismissal()

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const rootIds = useMemo(() => {
    return computeRootIds(tasks).filter((id) => {
      const task = tasksById.get(id)
      return task && !isHiddenFromPlan(task, decisions)
    })
  }, [tasks, tasksById, decisions])

  const addParent = useAddParent()
  const removeParent = useRemoveParent()
  const reorderTask = useReorderTask()
  const { pushUndo } = useUndo()

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useDndMonitor({ onDragEnd: handleDragEnd })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    // The DndContext is shared with PlanCalendar (item 5's drag-to-schedule);
    // ignore drops that aren't onto another row in this tree.
    if (!tasksById.has(activeId) || !tasksById.has(overId)) return
    const activeRect = active.rect.current.translated
    if (!activeRect) return
    const relativeY = (activeRect.top + activeRect.height / 2 - over.rect.top) / over.rect.height

    const action = resolveDropAction(activeId, overId, relativeY, tasks)
    if (!action) return
    const activeTask = tasksById.get(activeId)
    if (!activeTask) return

    if (action.kind === 'reorder') {
      const previousOrder = activeTask.order
      reorderTask.mutate(
        { id: activeId, afterId: action.afterId, beforeId: action.beforeId },
        {
          onSuccess: () =>
            pushUndo({
              label: 'Reorder task',
              undo: () =>
                reorderTask.mutateAsync({
                  id: activeId,
                  afterId: null,
                  beforeId: null,
                  order: previousOrder,
                }),
            }),
        },
      )
      return
    }

    const previousParentIds = [...activeTask.parent_ids]
    const newParentId = action.parentId
    addParent.mutate(
      { id: activeId, parentId: newParentId },
      {
        onSuccess: async () => {
          for (const parentId of previousParentIds) {
            await removeParent.mutateAsync({ id: activeId, parentId })
          }
          pushUndo({
            label: 'Move task',
            undo: async () => {
              await removeParent.mutateAsync({ id: activeId, parentId: newParentId })
              for (const parentId of previousParentIds) {
                await addParent.mutateAsync({ id: activeId, parentId })
              }
            },
          })
        },
      },
    )
  }

  return (
    <div className="flex h-full flex-col" data-testid="task-tree">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Tasks
        </span>
        <button
          type="button"
          title="New task"
          onClick={() => onOpenNewTask(null)}
          className="flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {rootIds.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-secondary">
            No tasks yet. Click + to create one.
          </p>
        )}
        {rootIds.map((id) => (
          <TaskTreeNode
            key={id}
            taskId={id}
            tasksById={tasksById}
            depth={0}
            selectedId={selectedId}
            expanded={expanded}
            ancestorPath={new Set()}
            onSelect={onSelect}
            onToggleExpand={toggleExpand}
            onAddChild={onOpenNewTask}
            decisions={decisions}
            onDecide={decide}
            onUndecide={undecide}
          />
        ))}
      </div>
    </div>
  )
}
