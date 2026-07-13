import { describe, expect, it } from 'vitest'
import { chipFillStyle, primaryChipColor } from './eventColor'
import { COLOR_HEX } from '../tree/colors'

describe('chipFillStyle', () => {
  it('falls back to a neutral solid fill with no colors', () => {
    expect(chipFillStyle([])).toEqual({ backgroundColor: '#616161' })
  })

  it('returns a solid fill for exactly one color', () => {
    expect(chipFillStyle(['red'])).toEqual({ backgroundColor: COLOR_HEX.red })
  })

  it('returns a diagonal split gradient for exactly two colors', () => {
    expect(chipFillStyle(['red', 'blue'])).toEqual({
      background: `linear-gradient(135deg, ${COLOR_HEX.red} 50%, ${COLOR_HEX.blue} 50%)`,
    })
  })

  it('falls back to the first two colors for three or more', () => {
    expect(chipFillStyle(['red', 'blue', 'green'])).toEqual({
      background: `linear-gradient(135deg, ${COLOR_HEX.red} 50%, ${COLOR_HEX.blue} 50%)`,
    })
  })

  it('ignores unknown color names', () => {
    expect(chipFillStyle(['not-a-real-color'])).toEqual({ backgroundColor: '#616161' })
  })
})

describe('primaryChipColor', () => {
  it('returns the hex for the first color', () => {
    expect(primaryChipColor(['blue', 'red'])).toBe(COLOR_HEX.blue)
  })

  it('falls back to neutral gray with no colors', () => {
    expect(primaryChipColor([])).toBe('#616161')
  })
})
