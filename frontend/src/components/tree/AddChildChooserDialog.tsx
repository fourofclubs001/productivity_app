import Dialog from '../common/Dialog'
import Button from '../common/Button'

const choice =
  'rounded-sm border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover'

export default function AddChildChooserDialog({
  onChooseNew,
  onChooseExisting,
  onClose,
}: {
  onChooseNew: () => void
  onChooseExisting: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      onClose={onClose}
      className="w-[340px]"
      title="Add child task"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onChooseNew} className={choice}>
          Create new task
        </button>
        <button type="button" onClick={onChooseExisting} className={choice}>
          Attach existing task
        </button>
      </div>
    </Dialog>
  )
}
