import Dialog from './Dialog'
import Button from './Button'

export default function AlertDialog({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <Dialog
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          OK
        </Button>
      }
    >
      <p className="text-sm text-text-primary">{message}</p>
    </Dialog>
  )
}
