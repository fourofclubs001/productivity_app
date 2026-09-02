import Dialog from '../common/Dialog'
import Button from '../common/Button'

export default function GroupDeleteDialog({
  groupName,
  onDeleteChildren,
  onUngroup,
  onCancel,
  isPending,
}: {
  groupName: string
  onDeleteChildren: () => void
  onUngroup: () => void
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
          <Button variant="neutral" onClick={onUngroup} disabled={isPending}>
            Ungroup
          </Button>
          <Button variant="danger" onClick={onDeleteChildren} disabled={isPending}>
            Delete children too
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-primary">
        Delete the group &ldquo;{groupName}&rdquo;? Choose what happens to anything inside it.
      </p>
    </Dialog>
  )
}
