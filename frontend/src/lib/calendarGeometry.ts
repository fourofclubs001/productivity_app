const MINUTES_PER_DAY = 24 * 60
const SNAP_MINUTES = 30

export interface DropPoint {
  clientX: number
  clientY: number
}

export interface GridGeometry {
  left: number
  top: number
  width: number
  height: number
  scrollTop: number
}

export interface ResolvedSlot {
  dayIndex: number
  minutesFromMidnight: number
}

/**
 * Maps a drop point (viewport coordinates) onto a day/time slot within the
 * calendar's rendered time grid. The grid always spans a full 24h per day
 * column (react-big-calendar's default min/max), so a fraction of the grid's
 * height maps directly to a fraction of the day -- scrollTop has to be added
 * back in since the point comes from viewport coordinates but the grid
 * scrolls internally.
 *
 * Returns null if the drop point falls outside the grid entirely.
 */
export function resolveDropSlot(
  point: DropPoint,
  grid: GridGeometry,
  dayCount = 7,
): ResolvedSlot | null {
  const relativeX = point.clientX - grid.left
  const relativeY = point.clientY - grid.top + grid.scrollTop

  if (relativeX < 0 || relativeX > grid.width) return null
  if (relativeY < 0 || relativeY > grid.height) return null

  const dayIndex = Math.min(dayCount - 1, Math.floor((relativeX / grid.width) * dayCount))
  const rawMinutes = (relativeY / grid.height) * MINUTES_PER_DAY
  const minutesFromMidnight = Math.min(
    MINUTES_PER_DAY - SNAP_MINUTES,
    Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES,
  )
  return { dayIndex, minutesFromMidnight }
}

/** weekAnchor is the Monday of the displayed week; durationMinutes defaults
 * to one hour, matching the default duration used elsewhere for new intervals. */
export function slotToInterval(
  slot: ResolvedSlot,
  weekAnchor: Date,
  durationMinutes = 60,
): { start: Date; end: Date } {
  const start = new Date(weekAnchor)
  start.setDate(start.getDate() + slot.dayIndex)
  start.setHours(0, slot.minutesFromMidnight, 0, 0)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return { start, end }
}
