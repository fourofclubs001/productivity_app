import { describe, expect, it, vi } from 'vitest'
import { drawFavicon, faviconState, formatFaviconLabel } from './favicon'

describe('formatFaviconLabel', () => {
  it('formats as mm:ss below one hour', () => {
    expect(formatFaviconLabel(0)).toBe('00:00')
    expect(formatFaviconLabel(65_000)).toBe('01:05')
    expect(formatFaviconLabel(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('formats as h:mm:ss from one hour on', () => {
    expect(formatFaviconLabel(60 * 60_000)).toBe('1:00:00')
    expect(formatFaviconLabel(61 * 60_000 + 5_000)).toBe('1:01:05')
    expect(formatFaviconLabel(10 * 3_600_000 + 4 * 60_000 + 9_000)).toBe('10:04:09')
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
