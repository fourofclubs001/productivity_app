import { format } from 'date-fns'
import type { GoogleEvent } from '../../types'

// Read-only -- pulled-in Google Calendar events aren't owned by this app
// (M40), so there's nothing here to edit, only to view.
export default function GoogleEventDetailPanel({
  event,
  onClose,
}: {
  event: GoogleEvent
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl"
        data-testid="google-event-detail-panel"
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          Google Calendar event
        </p>
        <h2 className="mb-2 text-lg font-semibold text-text-primary">{event.title}</h2>
        <p className="mb-3 text-sm text-text-secondary">
          {format(new Date(event.start), 'EEE MMM d, HH:mm')} –{' '}
          {format(new Date(event.end), 'HH:mm')}
        </p>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary">
            Description
          </label>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">
            {event.description || 'No description'}
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
