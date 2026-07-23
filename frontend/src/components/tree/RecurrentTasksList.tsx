import { useState } from 'react'
import type { Task } from '../../types'
import { useDeleteTask } from '../../api/tasks'
import { useDeleteRecurrentGroup } from '../../api/recurrentTasks'
import { buildRecurrentTree, type RecurrentNode } from '../../lib/recurrentTaskTree'
import AlertDialog from '../common/AlertDialog'
import ConfirmDialog from '../common/ConfirmDialog'
import ContextMenu from '../calendar/ContextMenu'
import ColorDots from './ColorDots'
import GroupDeleteDialog from './GroupDeleteDialog'
import NewRecurrentGroupDialog from './NewRecurrentGroupDialog'
import NewRecurrentItemChooserDialog from './NewRecurrentItemChooserDialog'
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

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-sm ${
          !isGroup && selectedId === task.id
            ? 'bg-accent-soft text-accent'
            : 'text-text-primary hover:bg-surface-hover'
        }`}
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
        <ContextMenu
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
            deleteTask.mutate(task.id, {
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

export default function RecurrentTasksList({
  tasks,
  selectedId,
  onSelect,
  onOpenNewRecurrentTask,
}: {
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenNewRecurrentTask: () => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showChooser, setShowChooser] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)

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
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Recurrent tasks
        </span>
        <button
          type="button"
          title="New recurrent item"
          onClick={() => setShowChooser(true)}
          className="flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {tree.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-secondary">
            No recurrent tasks yet. Click + to create a repeating task.
          </p>
        )}
        {tree.map((node) => (
          <RecurrentItemRow
            key={node.task.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {showChooser && (
        <NewRecurrentItemChooserDialog
          onClose={() => setShowChooser(false)}
          onChooseTask={() => {
            setShowChooser(false)
            onOpenNewRecurrentTask()
          }}
          onChooseGroup={() => {
            setShowChooser(false)
            setShowNewGroup(true)
          }}
        />
      )}
      {showNewGroup && (
        <NewRecurrentGroupDialog
          onClose={() => setShowNewGroup(false)}
          onCreated={(task) => {
            setShowNewGroup(false)
            setExpanded((prev) => new Set(prev).add(task.id))
          }}
        />
      )}
    </div>
  )
}
