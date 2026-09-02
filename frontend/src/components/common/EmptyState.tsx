import type { ReactNode } from 'react'

export default function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
      <p className="text-ui text-text-primary">{title}</p>
      {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
