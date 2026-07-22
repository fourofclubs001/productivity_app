import { useState } from 'react'
import type { Task } from '../../types'
import { useDeleteTask } from '../../api/tasks'
import AlertDialog from '../common/AlertDialog'
import ConfirmDialog from '../common/ConfirmDialog'
import ContextMenu from '../calendar/ContextMenu'
import ColorDots from './ColorDots'
import StateBadge from './StateBadge'

function RoutineRow({
  task,
  isSelected,
  onSelect,
}: {
  task: Task
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const deleteTask = useDeleteTask()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-sm ${
          isSelected ? 'bg-accent-soft text-accent' : 'text-text-primary hover:bg-surface-hover'
        }`}
        style={{ paddingLeft: 4 }}
        onClick={() => onSelect(task.id)}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <ColorDots colors={task.effective_colors} />
        <span className="flex-1 truncate">{task.name}</span>
        <StateBadge state={task.state} />
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
            deleteTask.mutate(task.id, {
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

export default function RoutinesList({
  tasks,
  selectedId,
  onSelect,
  onOpenNewRoutine,
}: {
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenNewRoutine: () => void
}) {
  const routines = tasks
    .filter((task) => task.is_routine)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex h-full flex-col" data-testid="routines-list">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Routines
        </span>
        <button
          type="button"
          title="New routine"
          onClick={onOpenNewRoutine}
          className="flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {routines.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-secondary">
            No routines yet. Click + to create a repeating task.
          </p>
        )}
        {routines.map((task) => (
          <RoutineRow
            key={task.id}
            task={task}
            isSelected={selectedId === task.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
