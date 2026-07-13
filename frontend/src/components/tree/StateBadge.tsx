import type { TaskState } from '../../types'

const STATE_META: Record<TaskState, { label: string; className: string }> = {
  backlog: { label: 'Backlog', className: 'bg-surface-alt text-text-secondary' },
  sprint_backlog: { label: 'Sprint backlog', className: 'bg-warning-soft text-warning' },
  in_progress: { label: 'In progress', className: 'bg-accent-soft text-accent' },
  sprint_done: { label: 'Sprint done', className: 'bg-success-soft text-success' },
  done: { label: 'Done', className: 'bg-success text-white' },
}

export default function StateBadge({ state }: { state: TaskState }) {
  const meta = STATE_META[state]
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}
