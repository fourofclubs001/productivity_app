import { useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Task } from '../../types'
import { isHiddenFromPlan, qualifiesForRemovalPrompt } from '../../lib/taskTree'
import type { ParentDecision } from '../../lib/useParentDismissal'
import { useDeleteTask, useKeepAsBacklog } from '../../api/tasks'
import { useUndo, type UndoEntry } from '../../undo/UndoProvider'
import AlertDialog from '../common/AlertDialog'
import ConfirmDialog from '../common/ConfirmDialog'
import ContextMenu from '../calendar/ContextMenu'
import ColorDots from './ColorDots'
import StateBadge from './StateBadge'

interface TaskTreeNodeProps {
  taskId: string
  tasksById: Map<string, Task>
  depth: number
  selectedId: string | null
  expanded: Set<string>
  ancestorPath: Set<string>
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onAddChild: (parentId: string) => void
  decisions: Record<string, ParentDecision>
  onDecide: (taskId: string, decision: ParentDecision) => void
  onUndecide: (taskId: string) => void
}

export default function TaskTreeNode({
  taskId,
  tasksById,
  depth,
  selectedId,
  expanded,
  ancestorPath,
  onSelect,
  onToggleExpand,
  onAddChild,
  decisions,
  onDecide,
  onUndecide,
}: TaskTreeNodeProps) {
  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: taskId,
  })
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: taskId })
  const { pushUndo } = useUndo()
  const keepAsBacklog = useKeepAsBacklog()
  const deleteTask = useDeleteTask()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  function hiddenEntry(): UndoEntry {
    return {
      label: 'Hide completed goal',
      run: () => {
        onDecide(taskId, 'hidden')
        return visibleEntry()
      },
    }
  }

  function visibleEntry(): UndoEntry {
    return {
      label: 'Restore completed goal',
      run: () => {
        onUndecide(taskId)
        return hiddenEntry()
      },
    }
  }

  const task = tasksById.get(taskId)
  if (!task) return null

  if (ancestorPath.has(taskId)) {
    return (
      <div className="px-2 py-1 text-xs text-danger" style={{ paddingLeft: depth * 16 + 8 }}>
        cycle detected ({task.name})
      </div>
    )
  }

  if (qualifiesForRemovalPrompt(task, tasksById, decisions)) {
    return (
      <div
        className="rounded px-2 py-1.5 text-xs text-text-secondary"
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        <p>
          <strong className="text-text-primary">{task.name}</strong>'s sub-tasks are all done —
          remove it from Plan too?
        </p>
        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onDecide(taskId, 'kept')
              keepAsBacklog.mutate(taskId)
            }}
            className="hover:text-text-primary"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => {
              onDecide(taskId, 'hidden')
              pushUndo(visibleEntry())
            }}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Yes
          </button>
        </div>
      </div>
    )
  }

  const isExpanded = expanded.has(taskId)
  const isSelected = selectedId === taskId
  const nextAncestorPath = new Set(ancestorPath).add(taskId)
  const visibleChildIds = task.children_ids.filter((childId) => {
    const child = tasksById.get(childId)
    return child && !isHiddenFromPlan(child, decisions)
  })

  return (
    <div>
      <div
        ref={(node) => {
          setDraggableRef(node)
          setDroppableRef(node)
        }}
        {...listeners}
        {...attributes}
        className={`group flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-sm ${
          isSelected ? 'bg-accent-soft text-accent' : 'text-text-primary hover:bg-surface-hover'
        } ${isDragging ? 'opacity-40' : ''} ${
          isOver ? 'outline outline-2 outline-accent' : ''
        }`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => onSelect(taskId)}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpand(taskId)
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
            task.is_leaf ? 'invisible' : ''
          }`}
        >
          {task.is_leaf ? '' : isExpanded ? '▾' : '▸'}
        </button>
        <ColorDots colors={task.effective_colors} />
        <span className="flex-1 truncate">{task.name}</span>
        <StateBadge state={task.state} />
        <button
          type="button"
          title="Add sub-task"
          onClick={(event) => {
            event.stopPropagation()
            onAddChild(taskId)
          }}
          className="invisible h-4 w-4 shrink-0 text-center leading-none text-text-secondary hover:text-text-primary group-hover:visible"
        >
          +
        </button>
      </div>
      {isExpanded && !task.is_leaf && (
        <div>
          {visibleChildIds.map((childId) => (
            <TaskTreeNode
              key={childId}
              taskId={childId}
              tasksById={tasksById}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              ancestorPath={nextAncestorPath}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onAddChild={onAddChild}
              decisions={decisions}
              onDecide={onDecide}
              onUndecide={onUndecide}
            />
          ))}
        </div>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Delete',
              danger: true,
              onSelect: () => setConfirmingDelete(true),
            },
          ]}
        />
      )}
      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete "${task.name}" permanently?`}
          confirmLabel="Delete"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() =>
            deleteTask.mutate(taskId, {
              onError: (error) => setAlertMessage((error as Error).message),
              onSettled: () => setConfirmingDelete(false),
            })
          }
        />
      )}
      {alertMessage && <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />}
    </div>
  )
}
