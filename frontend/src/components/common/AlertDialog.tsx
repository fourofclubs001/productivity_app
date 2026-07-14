export default function AlertDialog({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <p className="text-sm text-text-primary">{message}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
