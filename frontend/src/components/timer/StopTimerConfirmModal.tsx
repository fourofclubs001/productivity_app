import Dialog from '../common/Dialog'
import Button from '../common/Button'

export default function StopTimerConfirmModal({
  taskName,
  definitionOfDone,
  onMarkDone,
  onStopOnly,
  onCancel,
  isPending,
}: {
  taskName: string
  definitionOfDone: string
  onMarkDone: () => void
  onStopOnly: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <Dialog
      onClose={onCancel}
      title="Is the definition of done fulfilled?"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="neutral" onClick={onStopOnly} disabled={isPending}>
            No, stop the timer
          </Button>
          <Button variant="success" onClick={onMarkDone} disabled={isPending}>
            Yes
          </Button>
        </>
      }
    >
      <p className="text-2xs font-medium uppercase tracking-wider text-text-secondary">{taskName}</p>
      <p className="mt-1 text-sm text-text-primary">{definitionOfDone}</p>
    </Dialog>
  )
}
