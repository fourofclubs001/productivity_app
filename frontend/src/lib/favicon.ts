export type FaviconState = 'neutral' | 'green'

const FAVICON_SIZE = 32
const COLORS: Record<Exclude<FaviconState, 'neutral'>, string> = {
  green: '#16a34a',
}

export function formatFaviconLabel(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function faviconState(active: boolean): FaviconState {
  return active ? 'green' : 'neutral'
}

// Issues the actual draw calls -- kept separate from `applyFavicon` so it's
// unit-testable by passing a hand-rolled fake 2D context, since jsdom (this
// repo's vitest environment) has no real <canvas> implementation. The live
// elapsed-time digits live in the tab title (see GlobalTimerWatcher), not
// drawn onto the icon -- this only ever swaps the icon's color.
export function drawFavicon(
  ctx: CanvasRenderingContext2D,
  state: FaviconState,
  size: number = FAVICON_SIZE,
): void {
  ctx.clearRect(0, 0, size, size)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = state === 'neutral' ? '#94a3b8' : COLORS[state]
  ctx.fill()
}

let originalHref: string | null = null
let originalType: string | null = null

function faviconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel="icon"]')
}

// The imperative outer shell: creates an offscreen canvas, draws into it,
// and swaps the <link rel="icon">'s href. Not meaningfully unit-testable
// (real coverage comes from a Playwright spec reading the actual <link>'s
// href in a real Chromium tab, which fully implements canvas) -- kept as a
// thin wrapper around the tested `drawFavicon` above.
export function applyFavicon(state: FaviconState): void {
  const link = faviconLink()
  if (!link) return

  if (originalHref === null) {
    originalHref = link.href
    originalType = link.type
  }

  if (state === 'neutral') {
    link.href = originalHref
    if (originalType) link.type = originalType
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = FAVICON_SIZE
  canvas.height = FAVICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  drawFavicon(ctx, state)
  // A PNG data URL under the SVG-typed <link> from index.html risks being
  // ignored by some browsers -- update the type alongside the href.
  link.type = 'image/png'
  link.href = canvas.toDataURL('image/png')
}
