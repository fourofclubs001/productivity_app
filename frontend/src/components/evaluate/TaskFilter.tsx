import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../../types'
import { flattenTree, rootIds as computeRootIds, treeChildIds } from '../../lib/taskTree'

export default function TaskFilter({
  tasks,
  selectedIds,
  onChange,
}: {
  tasks: Task[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
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
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const visibleIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks])
  const rootIds = useMemo(() => computeRootIds(tasks), [tasks])
  const rows = useMemo(
    () => flattenTree(rootIds, visibleIds, tasksById, expanded),
    [rootIds, visibleIds, tasksById, expanded],
  )

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((taskId) => taskId !== id) : [...selectedIds, id],
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover"
      >
        Tasks: {selectedIds.length > 0 ? selectedIds.length : 'All'}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-xl">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 block w-full rounded px-1 py-1 text-left text-xs text-accent hover:bg-surface-hover"
            >
              Clear filter
            </button>
          )}
          {rows.length === 0 && (
            <p className="px-1 py-1 text-xs text-text-secondary">No tasks yet.</p>
          )}
          {rows.map(({ id, depth }) => {
            const task = tasksById.get(id)
            if (!task) return null
            const hasChildren = treeChildIds(id, visibleIds, tasksById).length > 0
            const isExpanded = expanded.has(id)
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-surface-hover"
                style={{ paddingLeft: depth * 16 }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(id)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
                    hasChildren ? '' : 'invisible'
                  }`}
                >
                  {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
                </button>
                <label className="flex flex-1 cursor-pointer items-center gap-1.5 text-text-primary">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(id)}
                    onChange={() => toggle(id)}
                  />
                  <span className="truncate">{task.name}</span>
                  {!task.is_leaf && <span className="shrink-0 text-text-secondary">(goal)</span>}
                </label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
