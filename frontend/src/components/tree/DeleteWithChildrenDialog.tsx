import Dialog from '../common/Dialog'
import Button from '../common/Button'

export default function DeleteWithChildrenDialog({
  taskName,
  onDeleteChildren,
  onJustThisTask,
  onCancel,
  isPending,
}: {
  taskName: string
  onDeleteChildren: () => void
  onJustThisTask: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <Dialog
      onClose={onCancel}
      className="w-[440px]"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="neutral" onClick={onJustThisTask} disabled={isPending}>
            Just this task
          </Button>
          <Button variant="danger" onClick={onDeleteChildren} disabled={isPending}>
            Delete whole subtree
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-primary">
        Delete &ldquo;{taskName}&rdquo;? It has sub-tasks — choose what happens to them.
      </p>
    </Dialog>
  )
}
