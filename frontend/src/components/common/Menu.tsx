import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

// A small popup action list anchored at a point (right-click or a kebab
// button). Clamps to the viewport, closes on Escape / outside click, and
// supports ArrowUp/Down + Enter. Replaces the old calendar/ContextMenu.
export default function Menu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [active, setActive] = useState(-1)

  // Flip left / up when the menu would overflow the viewport edge.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (x + rect.width > window.innerWidth) left = Math.max(4, x - rect.width)
    if (y + rect.height > window.innerHeight) top = Math.max(4, y - rect.height)
    setPos({ left, top })
  }, [x, y])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((i) => (i + 1) % items.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((i) => (i - 1 + items.length) % items.length)
      } else if (event.key === 'Enter' && active >= 0) {
        event.preventDefault()
        items[active].onSelect()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [items, active, onClose])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={onClose} />
      <div
        ref={ref}
        role="menu"
        className="fixed z-50 min-w-40 rounded-md bg-surface py-1 shadow-1 [animation:fade-in_100ms_ease-out]"
        style={{ left: pos.left, top: pos.top }}
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onMouseEnter={() => setActive(i)}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
            className={`block w-full px-3 text-left text-ui leading-8 ${
              item.danger ? 'text-danger hover:bg-danger-soft' : 'text-text-primary hover:bg-surface-hover'
            } ${active === i ? (item.danger ? 'bg-danger-soft' : 'bg-surface-hover') : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
