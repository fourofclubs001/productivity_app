import { useCallback, useEffect, useRef, useState } from 'react'

export function useResizableWidth(
  storageKey: string,
  defaultWidth: number,
  min: number,
  max: number,
) {
  const [width, setWidth] = useState<number>(() => {
    const stored = window.localStorage.getItem(storageKey)
    const parsed = stored ? Number(stored) : NaN
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : defaultWidth
  })
  const draggingRef = useRef(false)

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(width))
  }, [storageKey, width])

  const startResize = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      draggingRef.current = true
      const startX = event.clientX
      const startWidth = width

      function handleMouseMove(moveEvent: MouseEvent) {
        if (!draggingRef.current) return
        const next = startWidth + (moveEvent.clientX - startX)
        setWidth(Math.min(max, Math.max(min, next)))
      }
      function handleMouseUp() {
        draggingRef.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [width, min, max],
  )

  return { width, startResize }
}
