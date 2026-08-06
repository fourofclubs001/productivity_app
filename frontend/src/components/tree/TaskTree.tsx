import { useMemo, useState } from 'react'
import { useDndMonitor, type DragEndEvent, type DragMoveEvent } from '@dnd-kit/core'
import type { Task } from '../../types'
import TaskTreeNode from './TaskTreeNode'
import {
  isHiddenFromPlan,
  rootIds as computeRootIds,
  resolveDropAction,
  sameDropPreview,
  type DropPreview,
} from '../../lib/taskTree'
import { useAddParent, useRemoveParent, useReorderTask } from '../../api/tasks'
import { useUndo, type UndoEntry } from '../../undo/UndoProvider'
import { useParentDismissal } from '../../lib/useParentDismissal'
import { makeSetParentsEntry } from '../../lib/reparentUndo'

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
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null)
  const { decisions, decide, undecide } = useParentDismissal()

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const rootIds = useMemo(() => {
    // Recurrent tasks/groups live only in the Recurrent tasks tab (see
    // RecurrentTasksList.tsx), never duplicated into this tree. Both kinds
    // have parent_ids: [] (they're organizationally separate from the main
    // tree), so they'd otherwise trivially qualify as main-tree roots too.
    return computeRootIds(tasks).filter((id) => {
      const task = tasksById.get(id)
      return (
        task && !task.is_recurrent_task && !task.is_recurrent_group && !isHiddenFromPlan(task, decisions)
      )
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

  // Mirrors handleDragEnd's relativeY/resolveDropAction computation, but as a
  // non-mutating live preview. Deliberately onDragMove, not onDragOver --
  // onDragOver only fires when the *hovered target itself* changes, so it
  // never sees the pointer move from one third of the same row to another
  // (e.g. middle -> top edge without leaving the row), which is exactly the
  // transition between reparent and reorder previews this needs to track.
  // onDragMove fires on every pointer move regardless. Guarded with
  // sameDropPreview so a no-op re-render doesn't fire on every tick.
  function handleDragOver(event: DragMoveEvent) {
    const { active, over } = event
    if (!over) {
      setDropPreview((prev) => (prev === null ? prev : null))
      return
    }
    const activeId = String(active.id)
    const overId = String(over.id)
    if (!tasksById.has(activeId) || !tasksById.has(overId)) {
      setDropPreview((prev) => (prev === null ? prev : null))
      return
    }
    const activeRect = active.rect.current.translated
    if (!activeRect) return
    const relativeY = (activeRect.top + activeRect.height / 2 - over.rect.top) / over.rect.height
    const action = resolveDropAction(activeId, overId, relativeY, tasks)
    const next = action ? { overId, action } : null
    setDropPreview((prev) => (sameDropPreview(prev, next) ? prev : next))
  }

  useDndMonitor({
    onDragMove: handleDragOver,
    onDragEnd: (event) => {
      setDropPreview(null)
      handleDragEnd(event)
    },
    onDragCancel: () => setDropPreview(null),
  })

  // No server-generated id is involved in either transition (order is a
  // plain float, parent edges are set membership), so a simple symmetric
  // pair suffices: running an entry applies `target` and returns the entry
  // that applies `current` again.
  function reorderEntry(taskId: string, target: number, current: number): UndoEntry {
    return {
      label: 'Reorder task',
      views: ['plan'],
      run: async () => {
        await reorderTask.mutateAsync({ id: taskId, afterId: null, beforeId: null, order: target })
        return reorderEntry(taskId, current, target)
      },
    }
  }

  const reparentMutators = {
    addParentAsync: addParent.mutateAsync,
    removeParentAsync: removeParent.mutateAsync,
  }

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
          onSuccess: (updated) =>
            pushUndo(reorderEntry(activeId, previousOrder, updated.order)),
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
          pushUndo(
            makeSetParentsEntry(activeId, previousParentIds, [newParentId], reparentMutators),
          )
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
            dropPreview={dropPreview}
          />
        ))}
      </div>
    </div>
  )
}
