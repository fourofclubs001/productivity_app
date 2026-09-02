import Dialog from '../common/Dialog'
import Button from '../common/Button'

export default function DoneConfirmModal({
  taskName,
  definitionOfDone,
  onConfirm,
  onDismiss,
  isPending,
}: {
  taskName: string
  definitionOfDone: string
  onConfirm: () => void
  onDismiss: () => void
  isPending: boolean
}) {
  return (
    <Dialog
      onClose={onDismiss}
      title="Is the definition of done fulfilled?"
      footer={
        <>
          <Button variant="ghost" onClick={onDismiss}>
            No, keep in progress
          </Button>
          <Button variant="success" onClick={onConfirm} disabled={isPending}>
            Yes, done
          </Button>
        </>
      }
    >
      <p className="text-2xs font-medium uppercase tracking-wider text-text-secondary">{taskName}</p>
      <p className="mt-1 text-sm text-text-primary">{definitionOfDone}</p>
    </Dialog>
  )
}
