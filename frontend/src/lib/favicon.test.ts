import { describe, expect, it, vi } from 'vitest'
import { drawFavicon, faviconState, formatFaviconLabel } from './favicon'

describe('formatFaviconLabel', () => {
  it('formats elapsed time as mm:ss, not capped at 59 minutes', () => {
    expect(formatFaviconLabel(0)).toBe('00:00')
    expect(formatFaviconLabel(65_000)).toBe('01:05')
    expect(formatFaviconLabel(61 * 60_000)).toBe('61:00')
  })

  it('never goes negative', () => {
    expect(formatFaviconLabel(-500)).toBe('00:00')
  })
})

describe('faviconState', () => {
  it('is green while active', () => {
    expect(faviconState(true)).toBe('green')
  })

  it('is neutral otherwise', () => {
    expect(faviconState(false)).toBe('neutral')
  })
})

function fakeContext() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D
}

describe('drawFavicon', () => {
  it('draws only a colored background circle, no text, for either state', () => {
    const neutral = fakeContext()
    drawFavicon(neutral, 'neutral')
    expect(neutral.arc).toHaveBeenCalled()
    expect(neutral.fill).toHaveBeenCalled()
    expect(neutral.fillText).not.toHaveBeenCalled()

    const green = fakeContext()
    drawFavicon(green, 'green')
    expect(green.arc).toHaveBeenCalled()
    expect(green.fill).toHaveBeenCalled()
    expect(green.fillText).not.toHaveBeenCalled()
  })
})
