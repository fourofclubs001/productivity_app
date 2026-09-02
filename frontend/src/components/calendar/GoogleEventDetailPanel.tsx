import { format } from 'date-fns'
import type { GoogleEvent } from '../../types'
import Dialog from '../common/Dialog'
import Button from '../common/Button'

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
    <Dialog
      onClose={onClose}
      testId="google-event-detail-panel"
      title={event.title}
      subtitle={`${format(new Date(event.start), 'EEE MMM d, HH:mm')} – ${format(
        new Date(event.end),
        'HH:mm',
      )}`}
      footer={
        <Button variant="neutral" onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className="text-2xs font-medium uppercase tracking-wider text-text-secondary">
        Google Calendar event
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">
        {event.description || 'No description'}
      </p>
    </Dialog>
  )
}
