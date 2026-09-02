import Dialog from '../common/Dialog'
import Button from '../common/Button'

export default function ConfigDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      onClose={onClose}
      title="Configuration"
      footer={
        <Button variant="neutral" onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className="text-sm text-text-secondary">No settings yet.</p>
    </Dialog>
  )
}
