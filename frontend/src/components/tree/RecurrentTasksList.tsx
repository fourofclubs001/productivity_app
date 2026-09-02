import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useDndMonitor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { Task } from '../../types'
import { useDeleteTask } from '../../api/tasks'
import {
  useDeleteRecurrentGroup,
  useMoveRecurrentItem,
  useReorderRecurrentItem,
} from '../../api/recurrentTasks'
import { buildRecurrentTree, resolveRecurrentDropAction, type RecurrentNode } from '../../lib/recurrentTaskTree'
import AlertDialog from '../common/AlertDialog'
import ConfirmDialog from '../common/ConfirmDialog'
import Menu from '../common/Menu'
import ColorDots from './ColorDots'
import EmptyState from '../common/EmptyState'
import GroupDeleteDialog from './GroupDeleteDialog'
import StateBadge from './StateBadge'

function RecurrentItemRow({
  node,
  depth,
  expanded,
  onToggleExpand,
  selectedId,
  onSelect,
}: {
  node: RecurrentNode
  depth: number
  expanded: Set<string>
  onToggleExpand: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { task } = node
  const isGroup = task.is_recurrent_group
  const isExpanded = expanded.has(task.id)
  const hasChildren = node.children.length > 0
  const deleteTask = useDeleteTask()
  const deleteGroup = useDeleteRecurrentGroup()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingGroupDelete, setConfirmingGroupDelete] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: task.id,
  })
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: task.id })

  return (
    <div>
      <div
        ref={(el) => {
          setDraggableRef(el)
          setDroppableRef(el)
        }}
        {...listeners}
        {...attributes}
        className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-sm ${
          !isGroup && selectedId === task.id
            ? 'bg-accent-soft text-accent'
            : 'text-text-primary hover:bg-surface-hover'
        } ${isDragging ? 'opacity-40' : ''} ${isOver ? 'outline outline-2 outline-accent' : ''}`}
        style={{ paddingLeft: 4 + depth * 16 }}
        onClick={() => (isGroup ? onToggleExpand(task.id) : onSelect(task.id))}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        {isGroup ? (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center text-xs text-text-secondary"
            aria-hidden="true"
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </span>
        ) : (
          <ColorDots colors={task.effective_colors} />
        )}
        <span className="flex-1 truncate">{task.name}</span>
        {!isGroup && <StateBadge state={task.state} />}
      </div>
      {contextMenu && (
        <Menu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Delete',
              danger: true,
              onSelect: () => (isGroup ? setConfirmingGroupDelete(true) : setConfirmingDelete(true)),
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
            deleteTask.mutate({ id: task.id }, {
              onError: (error) => setAlertMessage((error as Error).message),
              onSettled: () => setConfirmingDelete(false),
            })
          }
        />
      )}
      {confirmingGroupDelete && (
        <GroupDeleteDialog
          groupName={task.name}
          isPending={deleteGroup.isPending}
          onCancel={() => setConfirmingGroupDelete(false)}
          onUngroup={() =>
            deleteGroup.mutate(
              { id: task.id, deleteChildren: false },
              {
                onError: (error) => setAlertMessage((error as Error).message),
                onSettled: () => setConfirmingGroupDelete(false),
              },
            )
          }
          onDeleteChildren={() =>
            deleteGroup.mutate(
              { id: task.id, deleteChildren: true },
              {
                onError: (error) => setAlertMessage((error as Error).message),
                onSettled: () => setConfirmingGroupDelete(false),
              },
            )
          }
        />
      )}
      {alertMessage && <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />}
      {isGroup && isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <RecurrentItemRow
              key={child.task.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecurrentTasksTree({
  tasks,
  tree,
  expanded,
  onToggleExpand,
  selectedId,
  onSelect,
}: {
  tasks: Task[]
  tree: RecurrentNode[]
  expanded: Set<string>
  onToggleExpand: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const moveItem = useMoveRecurrentItem()
  const reorderItem = useReorderRecurrentItem()

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeRect = active.rect.current.translated
    if (!activeRect) return
    const relativeY = (activeRect.top + activeRect.height / 2 - over.rect.top) / over.rect.height

    const action = resolveRecurrentDropAction(activeId, overId, relativeY, tasks)
    if (!action) return

    if (action.kind === 'reorder') {
      reorderItem.mutate({ id: activeId, afterId: action.afterId, beforeId: action.beforeId })
    } else {
      moveItem.mutate({ id: activeId, parentId: action.parentId })
    }
  }

  useDndMonitor({ onDragEnd: handleDragEnd })

  return (
    <>
      {tree.map((node) => (
        <RecurrentItemRow
          key={node.task.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export default function RecurrentTasksList({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // A second, independent DndContext scoped to just this panel -- dnd-kit
  // scopes drop targets to a DndContext's own children, which trivially
  // keeps this hierarchy's drags from ever interacting with the main task
  // tree's or the Plan calendar's, sharing the same PointerSensor tuning
  // (8px activation, matching PlanView.tsx) rather than relying on filter
  // logic to keep them apart (item 10).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const tree = buildRecurrentTree(tasks)

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col" data-testid="recurrent-tasks-list">
      <div className="flex-1 overflow-y-auto p-1">
        {tree.length === 0 && (
          <EmptyState
            title="No recurrent tasks yet"
            hint="Use + above to create a repeating task or a group."
          />
        )}
        <DndContext sensors={sensors}>
          <RecurrentTasksTree
            tasks={tasks}
            tree={tree}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </DndContext>
      </div>
    </div>
  )
}
