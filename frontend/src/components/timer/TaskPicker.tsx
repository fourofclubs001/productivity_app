import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../../types'
import { flattenTree, treeChildIds, treeRootIds } from '../../lib/taskTree'

const UNSELECTABLE_LEAF_STATES = new Set(['sprint_done', 'done'])

export default function TaskPicker({
  tasks,
  selectedId,
  onSelect,
  isHidden = (task) => task.is_leaf && UNSELECTABLE_LEAF_STATES.has(task.state),
  isSelectable = (task) => task.is_leaf,
  placeholder = 'Select a task…',
  emptyMessage = 'No tasks available to track',
}: {
  tasks: Task[]
  selectedId: string
  onSelect: (id: string) => void
  isHidden?: (task: Task) => boolean
  isSelectable?: (task: Task) => boolean
  placeholder?: string
  emptyMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  const visibleIds = useMemo(
    () => new Set(tasks.filter((task) => !isHidden(task)).map((task) => task.id)),
    [tasks, isHidden],
  )
  const rootIds = useMemo(() => treeRootIds(visibleIds, tasksById), [visibleIds, tasksById])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function select(id: string) {
    onSelect(id)
    setOpen(false)
  }

  // If the previously-selected task is no longer selectable (e.g. it just
  // became sprint_done), fall back to the placeholder rather than keep
  // showing a task that's no longer a valid choice.
  const selectedTask = selectedId && visibleIds.has(selectedId) ? tasksById.get(selectedId) : undefined
  const rows = flattenTree(rootIds, visibleIds, tasksById, expanded)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        data-testid="task-picker-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="min-w-[12rem] rounded border border-border bg-surface px-2 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover"
      >
        {selectedTask ? selectedTask.name : placeholder}
      </button>
      {open && (
        <div
          data-testid="task-picker-options"
          className="absolute left-0 z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-xl"
        >
          {rows.length === 0 && (
            <p className="px-2 py-2 text-xs text-text-secondary">{emptyMessage}</p>
          )}
          {rows.map(({ id, depth }) => {
            const task = tasksById.get(id)
            if (!task) return null
            const hasVisibleChildren = treeChildIds(id, visibleIds, tasksById).length > 0
            const isExpanded = expanded.has(id)
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded px-1 py-1 text-xs"
                style={{ paddingLeft: depth * 16 + 4 }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(id)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
                    hasVisibleChildren ? '' : 'invisible'
                  }`}
                >
                  {hasVisibleChildren ? (isExpanded ? '▾' : '▸') : ''}
                </button>
                {isSelectable(task) ? (
                  <button
                    type="button"
                    onClick={() => select(id)}
                    className={`flex-1 truncate text-left ${
                      selectedId === id ? 'font-medium text-accent' : 'text-text-primary hover:text-accent'
                    }`}
                  >
                    {task.name}
                  </button>
                ) : (
                  <span className="flex-1 truncate text-text-secondary">
                    {task.name}
                    <span className="ml-1.5 text-[10px]">(goal)</span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
