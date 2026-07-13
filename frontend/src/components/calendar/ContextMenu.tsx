export interface ContextMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={onClose} />
      <div
        className="fixed z-50 min-w-32 rounded border border-border bg-surface py-1 shadow-xl"
        style={{ left: x, top: y }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onSelect()
              onClose()
            }}
            className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-alt ${
              item.danger ? 'text-danger' : 'text-text-primary'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
