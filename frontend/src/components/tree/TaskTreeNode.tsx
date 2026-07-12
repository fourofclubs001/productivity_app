import type { Task } from '../../types'
import ColorDots from './ColorDots'
import StateBadge from './StateBadge'

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
}: TaskTreeNodeProps) {
  const task = tasksById.get(taskId)
  if (!task) return null

  if (ancestorPath.has(taskId)) {
    return (
      <div className="px-2 py-1 text-xs text-red-400" style={{ paddingLeft: depth * 16 + 8 }}>
        cycle detected ({task.name})
      </div>
    )
  }

  const isExpanded = expanded.has(taskId)
  const isSelected = selectedId === taskId
  const nextAncestorPath = new Set(ancestorPath).add(taskId)

  return (
    <div>
      <div
        className={`group flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-sm ${
          isSelected ? 'bg-blue-600/30 text-neutral-100' : 'text-neutral-300 hover:bg-neutral-800'
        }`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => onSelect(taskId)}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpand(taskId)
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-neutral-500 ${
            task.is_leaf ? 'invisible' : ''
          }`}
        >
          {task.is_leaf ? '' : isExpanded ? '▾' : '▸'}
        </button>
        <ColorDots colors={task.effective_colors} />
        <span className="flex-1 truncate">{task.name}</span>
        <StateBadge state={task.state} />
        <button
          type="button"
          title="Add sub-task"
          onClick={(event) => {
            event.stopPropagation()
            onAddChild(taskId)
          }}
          className="invisible h-4 w-4 shrink-0 text-center leading-none text-neutral-500 hover:text-neutral-200 group-hover:visible"
        >
          +
        </button>
      </div>
      {isExpanded && !task.is_leaf && (
        <div>
          {task.children_ids.map((childId) => (
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
