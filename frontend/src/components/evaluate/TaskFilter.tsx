import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../../types'
import { flattenTree, rootIds as computeRootIds, treeChildIds } from '../../lib/taskTree'
import { buildRecurrentTree, flattenRecurrentTree, recurrentNodeMap } from '../../lib/recurrentTaskTree'

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
  const [recurrentExpanded, setRecurrentExpanded] = useState<Set<string>>(new Set())
  const [tasksSectionOpen, setTasksSectionOpen] = useState(true)
  const [recurrentSectionOpen, setRecurrentSectionOpen] = useState(true)
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

  // The main tree excludes recurrent tasks/groups -- they render in their
  // own section below instead of leaking in as extra, ungrouped roots (they
  // always have parent_ids: [], so without this filter they'd otherwise
  // qualify as main-tree "roots" too).
  const plainTasks = useMemo(
    () => tasks.filter((task) => !task.is_recurrent_task && !task.is_recurrent_group),
    [tasks],
  )
  const visibleIds = useMemo(() => new Set(plainTasks.map((task) => task.id)), [plainTasks])
  const rootIds = useMemo(() => computeRootIds(plainTasks), [plainTasks])
  const rows = useMemo(
    () => flattenTree(rootIds, visibleIds, tasksById, expanded),
    [rootIds, visibleIds, tasksById, expanded],
  )

  const recurrentTree = useMemo(() => buildRecurrentTree(tasks), [tasks])
  const recurrentNodesById = useMemo(() => recurrentNodeMap(recurrentTree), [recurrentTree])
  const recurrentRows = useMemo(
    () => flattenRecurrentTree(recurrentTree, recurrentExpanded),
    [recurrentTree, recurrentExpanded],
  )

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleRecurrentExpand(id: string) {
    setRecurrentExpanded((prev) => {
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

  function renderRow(id: string, depth: number, hasChildren: boolean, isExpanded: boolean, onToggle: () => void) {
    const task = tasksById.get(id)
    if (!task) return null
    // A recurrent group is purely organizational -- no time is ever tracked
    // against it directly (unlike a main-tree "goal", the backend has no
    // rollup expanding a group selection into its recurrent children), so
    // it gets no checkbox, only an expand/collapse caret.
    const checkable = !task.is_recurrent_group
    return (
      <div
        key={id}
        className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-surface-hover"
        style={{ paddingLeft: depth * 16 }}
      >
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
            hasChildren ? '' : 'invisible'
          }`}
        >
          {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
        </button>
        {checkable ? (
          <label className="flex flex-1 cursor-pointer items-center gap-1.5 text-text-primary">
            <input type="checkbox" checked={selectedIds.includes(id)} onChange={() => toggle(id)} />
            <span className="truncate">{task.name}</span>
            {!task.is_leaf && <span className="shrink-0 text-text-secondary">(goal)</span>}
          </label>
        ) : (
          <span className="flex-1 truncate text-text-secondary">
            {task.name}
            <span className="ml-1.5 shrink-0">(group)</span>
          </span>
        )}
      </div>
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
        <div className="absolute right-0 z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-xl">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 block w-full rounded px-1 py-1 text-left text-xs text-accent hover:bg-surface-hover"
            >
              Clear filter
            </button>
          )}
          {rows.length === 0 && recurrentRows.length === 0 && (
            <p className="px-1 py-1 text-xs text-text-secondary">No tasks yet.</p>
          )}

          <button
            type="button"
            onClick={() => setTasksSectionOpen((prev) => !prev)}
            className="flex w-full items-center gap-1 px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-text-secondary"
          >
            <span>{tasksSectionOpen ? '▾' : '▸'}</span>
            <span>Tasks</span>
          </button>
          {tasksSectionOpen &&
            rows.map(({ id, depth }) =>
              renderRow(
                id,
                depth,
                treeChildIds(id, visibleIds, tasksById).length > 0,
                expanded.has(id),
                () => toggleExpand(id),
              ),
            )}

          <button
            type="button"
            onClick={() => setRecurrentSectionOpen((prev) => !prev)}
            className="mt-1 flex w-full items-center gap-1 px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-text-secondary"
          >
            <span>{recurrentSectionOpen ? '▾' : '▸'}</span>
            <span>Recurrent tasks</span>
          </button>
          {recurrentSectionOpen &&
            recurrentRows.map(({ id, depth }) =>
              renderRow(
                id,
                depth,
                (recurrentNodesById.get(id)?.children.length ?? 0) > 0,
                recurrentExpanded.has(id),
                () => toggleRecurrentExpand(id),
              ),
            )}
        </div>
      )}
    </div>
  )
}
