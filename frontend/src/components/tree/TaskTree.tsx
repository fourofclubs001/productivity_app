import { useMemo, useState } from 'react'
import type { Task } from '../../types'
import TaskTreeNode from './TaskTreeNode'

export default function TaskTree({
  tasks,
  selectedId,
  onSelect,
  onOpenNewTask,
}: {
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenNewTask: (parentId: string | null) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const rootIds = useMemo(
    () =>
      tasks
        .filter((task) => task.parent_ids.length === 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((task) => task.id),
    [tasks],
  )

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col" data-testid="task-tree">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Tasks
        </span>
        <button
          type="button"
          title="New task"
          onClick={() => onOpenNewTask(null)}
          className="flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {rootIds.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-secondary">
            No tasks yet. Click + to create one.
          </p>
        )}
        {rootIds.map((id) => (
          <TaskTreeNode
            key={id}
            taskId={id}
            tasksById={tasksById}
            depth={0}
            selectedId={selectedId}
            expanded={expanded}
            ancestorPath={new Set()}
            onSelect={onSelect}
            onToggleExpand={toggleExpand}
            onAddChild={onOpenNewTask}
          />
        ))}
      </div>
    </div>
  )
}
