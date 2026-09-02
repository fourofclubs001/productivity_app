import Dialog from '../common/Dialog'
import Button from '../common/Button'

const choice =
  'rounded-sm border border-border px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover'

export default function NewRecurrentItemChooserDialog({
  onChooseTask,
  onChooseGroup,
  onClose,
}: {
  onChooseTask: () => void
  onChooseGroup: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      onClose={onClose}
      className="w-[320px]"
      title="New…"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onChooseTask} className={choice}>
          Recurrent task
        </button>
        <button type="button" onClick={onChooseGroup} className={choice}>
          Recurrent group
        </button>
      </div>
    </Dialog>
  )
}
