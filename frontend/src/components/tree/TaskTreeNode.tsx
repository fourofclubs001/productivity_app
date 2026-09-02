import { useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Task } from '../../types'
import { isHiddenFromPlan, qualifiesForRemovalPrompt, type DropPreview } from '../../lib/taskTree'
import type { ParentDecision } from '../../lib/useParentDismissal'
import { useDeleteTask, useKeepAsBacklog } from '../../api/tasks'
import { useMarkDone, useMarkSubtreeDone, useRevertDone } from '../../api/timer'
import { makeMarkSubtreeDoneUndoEntry } from '../../lib/taskDoneUndoEntries'
import { useUndo, type UndoEntry } from '../../undo/UndoProvider'
import AlertDialog from '../common/AlertDialog'
import ConfirmDialog from '../common/ConfirmDialog'
import Menu from '../common/Menu'
import { ChevronRight, MoreVertical, Plus } from '../common/icons'
import ColorDots from './ColorDots'
import StateBadge from './StateBadge'
import DeleteWithChildrenDialog from './DeleteWithChildrenDialog'

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
  dropPreview: DropPreview | null
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
  dropPreview,
}: TaskTreeNodeProps) {
  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: taskId,
  })
  const { setNodeRef: setDroppableRef } = useDroppable({ id: taskId })
  const { pushUndo } = useUndo()
  const keepAsBacklog = useKeepAsBacklog()
  const deleteTask = useDeleteTask()
  const markSubtreeDone = useMarkSubtreeDone()
  const markDone = useMarkDone()
  const revertDone = useRevertDone()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  function hiddenEntry(): UndoEntry {
    return {
      label: 'Hide completed goal',
      views: ['plan'],
      run: () => {
        onDecide(taskId, 'hidden')
        return visibleEntry()
      },
    }
  }

  function visibleEntry(): UndoEntry {
    return {
      label: 'Restore completed goal',
      views: ['plan'],
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

  // Only the middle third (reparent) still gets the full-row outline; the
  // outer thirds (reorder) instead get a thin line at the shared boundary
  // with whichever neighbor the drop would land next to -- "it'll land
  // here, between these two rows," not "onto this row" (item 2).
  const isPreviewTarget = dropPreview?.overId === taskId
  const isReparentPreview = isPreviewTarget && dropPreview!.action.kind === 'reparent'
  const reorderEdge =
    isPreviewTarget && dropPreview!.action.kind === 'reorder'
      ? dropPreview!.action.beforeId === taskId
        ? 'top'
        : 'bottom'
      : null

  return (
    <div>
      <div
        ref={(node) => {
          setDraggableRef(node)
          setDroppableRef(node)
        }}
        {...listeners}
        {...attributes}
        className={`group relative flex h-7 cursor-grab items-center gap-2 rounded-sm px-1.5 text-ui active:cursor-grabbing ${
          isSelected
            ? 'bg-accent-soft text-accent hover:bg-accent-soft'
            : 'text-text-primary hover:bg-surface-hover'
        } ${isDragging ? 'opacity-40' : ''} ${
          isReparentPreview ? 'bg-accent-soft/60 ring-1 ring-inset ring-accent' : ''
        }`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => onSelect(taskId)}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        {reorderEdge && (
          <div
            data-testid="drop-reorder-line"
            className={`absolute inset-x-0 h-0.5 bg-accent ${reorderEdge === 'top' ? 'top-0' : 'bottom-0'}`}
          />
        )}
        <button
          type="button"
          aria-label={task.is_leaf ? undefined : isExpanded ? 'Collapse' : 'Expand'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpand(taskId)
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
            task.is_leaf ? 'invisible' : ''
          }`}
        >
          {!task.is_leaf && (
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          )}
        </button>
        <ColorDots colors={task.effective_colors} />
        <span className="flex-1 truncate">{task.name}</span>
        {/* Hide the badge for the two "quiet" states -- a column of gray
            "Backlog" pills on leaves is just noise; a kept former-goal
            reading Backlog still shows its badge. Done leaves are already
            hidden from Plan entirely. */}
        {!(task.is_leaf && task.state === 'backlog') && task.state !== 'done' && (
          <StateBadge state={task.state} />
        )}
        <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
          <button
            type="button"
            title="Add sub-task"
            onClick={(event) => {
              event.stopPropagation()
              onAddChild(taskId)
            }}
            className="flex h-5 w-5 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Task actions"
            aria-label="Task actions"
            onClick={(event) => {
              event.stopPropagation()
              setContextMenu({ x: event.clientX, y: event.clientY })
            }}
            className="flex h-5 w-5 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </div>
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
              dropPreview={dropPreview}
            />
          ))}
        </div>
      )}
      {contextMenu && (
        <Menu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Mark as done',
              onSelect: () =>
                markSubtreeDone.mutate(taskId, {
                  onSuccess: (affectedIds) => {
                    if (affectedIds.length === 0) return
                    pushUndo(
                      makeMarkSubtreeDoneUndoEntry(affectedIds, {
                        markDoneAsync: markDone.mutateAsync,
                        revertDoneAsync: revertDone.mutateAsync,
                      }),
                    )
                  },
                  onError: (error) => setAlertMessage((error as Error).message),
                }),
            },
            {
              label: 'Delete',
              danger: true,
              onSelect: () => setConfirmingDelete(true),
            },
          ]}
        />
      )}
      {confirmingDelete && task.is_leaf && (
        <ConfirmDialog
          message={`Delete "${task.name}" permanently?`}
          confirmLabel="Delete"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() =>
            deleteTask.mutate(
              { id: taskId },
              {
                onError: (error) => setAlertMessage((error as Error).message),
                onSettled: () => setConfirmingDelete(false),
              },
            )
          }
        />
      )}
      {confirmingDelete && !task.is_leaf && (
        <DeleteWithChildrenDialog
          taskName={task.name}
          isPending={deleteTask.isPending}
          onCancel={() => setConfirmingDelete(false)}
          onJustThisTask={() =>
            deleteTask.mutate(
              { id: taskId, deleteChildren: false },
              {
                onError: (error) => setAlertMessage((error as Error).message),
                onSettled: () => setConfirmingDelete(false),
              },
            )
          }
          onDeleteChildren={() =>
            deleteTask.mutate(
              { id: taskId, deleteChildren: true },
              {
                onError: (error) => setAlertMessage((error as Error).message),
                onSettled: () => setConfirmingDelete(false),
              },
            )
          }
        />
      )}
      {alertMessage && <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />}
    </div>
  )
}
