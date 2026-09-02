import type { TaskState } from '../../types'

const STATE_META: Record<TaskState, { label: string; className: string }> = {
  backlog: { label: 'Backlog', className: 'bg-surface-alt text-text-secondary' },
  sprint_backlog: { label: 'Sprint backlog', className: 'bg-warning-soft text-warning-text' },
  in_progress: { label: 'In progress', className: 'bg-accent-soft text-accent' },
  sprint_done: { label: 'Sprint done', className: 'bg-success-soft text-success' },
  // A finished task should recede -- neutral, not the loudest pill on screen
  done: { label: 'Done', className: 'bg-surface-alt text-text-tertiary' },
}

export default function StateBadge({ state }: { state: TaskState }) {
  const meta = STATE_META[state]
  return (
    <span
      className={`inline-flex h-[18px] shrink-0 items-center gap-0.5 rounded-full px-1.5 text-2xs font-medium leading-none ${meta.className}`}
    >
      {state === 'done' && <span aria-hidden>✓</span>}
      {meta.label}
    </span>
  )
}
