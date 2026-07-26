export default function ConfigDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Configuration</h2>
        <p className="text-sm text-text-secondary">No settings yet.</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
