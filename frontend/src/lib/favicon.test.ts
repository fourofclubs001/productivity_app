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
  it('is red whenever idle-stopped, regardless of the active flag', () => {
    expect(faviconState(true, true)).toBe('red')
    expect(faviconState(false, true)).toBe('red')
  })

  it('is green while active and not idle-stopped', () => {
    expect(faviconState(true, false)).toBe('green')
  })

  it('is neutral otherwise', () => {
    expect(faviconState(false, false)).toBe('neutral')
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
  it('draws only a colored background circle for neutral/red, no text', () => {
    const ctx = fakeContext()
    drawFavicon(ctx, 'red', '01:00')

    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.fillText).not.toHaveBeenCalled()
  })

  it('draws the elapsed-time label for the green state', () => {
    const ctx = fakeContext()
    drawFavicon(ctx, 'green', '01:05')

    expect(ctx.fillText).toHaveBeenCalledWith('01:05', expect.any(Number), expect.any(Number))
  })
})
