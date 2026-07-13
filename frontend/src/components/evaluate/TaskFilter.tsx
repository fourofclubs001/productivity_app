import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../types'

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

  const sortedTasks = [...tasks].sort((a, b) => a.name.localeCompare(b.name))

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
          {sortedTasks.length === 0 && (
            <p className="px-1 py-1 text-xs text-text-secondary">No tasks yet.</p>
          )}
          {sortedTasks.map((task) => (
            <label
              key={task.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-text-primary hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(task.id)}
                onChange={() => toggle(task.id)}
              />
              <span className="truncate">{task.name}</span>
              {!task.is_leaf && <span className="shrink-0 text-text-secondary">(goal)</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
