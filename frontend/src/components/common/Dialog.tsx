import { useEffect, useRef, type FormEventHandler, type ReactNode } from 'react'

// The one modal shell: a scrim + a centered surface. role="dialog"
// aria-modal, Escape to close, optional scrim-click to close, focus moved in
// on mount and restored on unmount, dialog-in animation. Replaces the ~19
// hand-rolled `fixed inset-0 ... bg-scrim` scaffolds.
//
// Pass `onSubmit` for a form dialog -- children + footer are then wrapped in
// a <form>, so a type="submit" button in the footer works.
export default function Dialog({
  onClose,
  title,
  subtitle,
  children,
  footer,
  onSubmit,
  dismissible = true,
  className = 'w-[400px]',
  labelledBy,
  testId,
}: {
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onSubmit?: FormEventHandler<HTMLFormElement>
  dismissible?: boolean
  className?: string
  labelledBy?: string
  testId?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) {
      const focusable = panel.querySelector<HTMLElement>(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      opener?.focus?.()
    }
  }, [dismissible, onClose])

  const body = (
    <>
      <div className={title || subtitle ? 'mt-4' : ''}>{children}</div>
      {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
    </>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim [animation:fade-in_100ms_ease-out]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-testid={testId}
        className={`max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md bg-surface p-6 shadow-2 [animation:dialog-in_120ms_ease-out] ${className}`}
      >
        {title && (
          <h2 className="text-base font-medium text-text-primary" id={labelledBy}>
            {title}
          </h2>
        )}
        {subtitle && <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>}
        {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
      </div>
    </div>
  )
}
