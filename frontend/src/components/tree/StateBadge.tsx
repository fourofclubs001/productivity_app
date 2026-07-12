import type { TaskState } from '../../types'

const STATE_META: Record<TaskState, { label: string; className: string }> = {
  backlog: { label: 'Backlog', className: 'border-neutral-600 text-neutral-500' },
  sprint_backlog: { label: 'Sprint backlog', className: 'border-amber-500 text-amber-400' },
  in_progress: { label: 'In progress', className: 'border-blue-500 text-blue-400' },
  sprint_done: { label: 'Sprint done', className: 'border-emerald-500 text-emerald-400' },
  done: { label: 'Done', className: 'border-emerald-500 bg-emerald-500 text-neutral-950' },
}

export default function StateBadge({ state }: { state: TaskState }) {
  const meta = STATE_META[state]
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] leading-none ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}
