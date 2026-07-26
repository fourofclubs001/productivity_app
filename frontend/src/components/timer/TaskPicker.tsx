import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../../types'
import { flattenTree, treeChildIds, treeRootIds } from '../../lib/taskTree'
import { buildRecurrentTree, flattenRecurrentTree, recurrentNodeMap } from '../../lib/recurrentTaskTree'

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

  // The main tree excludes recurrent tasks/groups -- they render in their
  // own section below instead of leaking in as extra, ungrouped roots (they
  // always have parent_ids: [], so without this filter they'd otherwise
  // qualify as main-tree "roots" too).
  const visibleIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((task) => !task.is_recurrent_task && !task.is_recurrent_group)
          .filter((task) => !isHidden(task))
          .map((task) => task.id),
      ),
    [tasks, isHidden],
  )
  const rootIds = useMemo(() => treeRootIds(visibleIds, tasksById), [visibleIds, tasksById])
  const rows = flattenTree(rootIds, visibleIds, tasksById, expanded)

  // A recurrent group always computes is_leaf: true (it has no main-tree
  // children_ids, only recurrent_parent_id edges) -- so the isSelectable/
  // isHidden predicates above can't be trusted to exclude it the way they
  // exclude a main-tree "goal". Groups are forced non-selectable and always
  // shown here instead, mirroring RecurrentTasksList.tsx's own convention.
  const recurrentTree = useMemo(() => buildRecurrentTree(tasks), [tasks])
  const recurrentNodesById = useMemo(() => recurrentNodeMap(recurrentTree), [recurrentTree])
  const recurrentRows = useMemo(
    () =>
      flattenRecurrentTree(recurrentTree, recurrentExpanded).filter(({ id }) => {
        const task = tasksById.get(id)
        return task ? task.is_recurrent_group || !isHidden(task) : false
      }),
    [recurrentTree, recurrentExpanded, tasksById, isHidden],
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

  function select(id: string) {
    onSelect(id)
    setOpen(false)
  }

  // If the previously-selected task is no longer selectable (e.g. it just
  // became sprint_done), fall back to the placeholder rather than keep
  // showing a task that's no longer a valid choice. Spans both sections --
  // the selected task may be a recurrent one.
  const isOffered =
    !!selectedId && (visibleIds.has(selectedId) || recurrentRows.some((row) => row.id === selectedId))
  const selectedTask = isOffered ? tasksById.get(selectedId) : undefined

  function renderRow(id: string, depth: number, hasVisibleChildren: boolean, isExpanded: boolean, onToggle: () => void) {
    const task = tasksById.get(id)
    if (!task) return null
    const selectable = !task.is_recurrent_group && isSelectable(task)
    return (
      <div
        key={id}
        className="flex items-center gap-1.5 rounded px-1 py-1 text-xs"
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
            hasVisibleChildren ? '' : 'invisible'
          }`}
        >
          {hasVisibleChildren ? (isExpanded ? '▾' : '▸') : ''}
        </button>
        {selectable ? (
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
            <span className="ml-1.5 text-[10px]">{task.is_recurrent_group ? '(group)' : '(goal)'}</span>
          </span>
        )}
      </div>
    )
  }

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
          className="absolute left-0 z-20 mt-1 max-h-96 w-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-xl"
        >
          {rows.length === 0 && recurrentRows.length === 0 && (
            <p className="px-2 py-2 text-xs text-text-secondary">{emptyMessage}</p>
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
