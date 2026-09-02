import type { CSSProperties } from 'react'
import { COLOR_HEX } from '../tree/colors'

const FALLBACK_HEX = '#616161'

/**
 * Solid fill for one color; a diagonal split for exactly two. Three or more
 * colors fall back to using just the first two, per the interpreted spec --
 * no task-coloring UI lets you pick more than a small handful anyway.
 */
export function chipFillStyle(colors: string[]): CSSProperties {
  const hexColors = colors.map((color) => COLOR_HEX[color]).filter((hex): hex is string => !!hex)
  if (hexColors.length === 0) return { backgroundColor: FALLBACK_HEX }
  if (hexColors.length === 1) return { backgroundColor: hexColors[0] }
  const [first, second] = hexColors
  return { background: `linear-gradient(135deg, ${first} 50%, ${second} 50%)` }
}

export function primaryChipColor(colors: string[]): string {
  return COLOR_HEX[colors[0]] ?? FALLBACK_HEX
}

// Tracked-time (Entry) chips on the merged Plan calendar: same hue as the
// task, but a pale tint with a solid left-border, drawn on top of the
// planned chip so "did what was planned" reads as an overlap. Distinct from
// chipFillStyle's solid planned fill (v08 item 4 / UX-20).
export function trackedChipStyle(colors: string[]): CSSProperties {
  const hex = primaryChipColor(colors)
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 20%, white)`,
    borderLeft: `3px solid ${hex}`,
    color: 'var(--color-text-primary)',
  }
}

// Pulled-in Google Calendar events aren't tied to a task, so they can't use
// chipFillStyle's color logic -- a fixed neutral/outlined look keeps them
// visually distinct from the user's own scheduled work. Applied as an inline
// style on the chip, so the theme CSS vars resolve.
export const EXTERNAL_EVENT_STYLE: CSSProperties = {
  backgroundColor: 'var(--color-surface-hover)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border)',
}
