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
