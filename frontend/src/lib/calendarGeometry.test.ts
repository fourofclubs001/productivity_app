import { describe, expect, it } from 'vitest'
import { resolveDropSlot, slotToInterval, type GridGeometry } from './calendarGeometry'

const GRID: GridGeometry = { left: 100, top: 50, width: 700, height: 480, scrollTop: 0 }

describe('resolveDropSlot', () => {
  it('maps a point at the grid origin to day 0, midnight', () => {
    expect(resolveDropSlot({ clientX: 100, clientY: 50 }, GRID)).toEqual({
      dayIndex: 0,
      minutesFromMidnight: 0,
    })
  })

  it('maps a point in the middle of the grid to the middle day, midday', () => {
    // width 700 / 7 days = 100px per day; x=450 -> relative 350 -> day 3
    // height 480 -> relative 240 -> half of 1440 min = 720 (noon)
    expect(resolveDropSlot({ clientX: 450, clientY: 290 }, GRID)).toEqual({
      dayIndex: 3,
      minutesFromMidnight: 720,
    })
  })

  it('clamps the last pixel column to the last day index', () => {
    const result = resolveDropSlot({ clientX: 100 + 699, clientY: 50 }, GRID)
    expect(result?.dayIndex).toBe(6)
  })

  it('snaps minutes to the nearest 30-minute step', () => {
    // relative Y = 10px out of 480 -> ~30 min raw -> should snap to 30
    const result = resolveDropSlot({ clientX: 100, clientY: 50 + 10 }, GRID)
    expect(result?.minutesFromMidnight).toBe(30)
  })

  it('accounts for scrollTop when the grid is scrolled', () => {
    const scrolled: GridGeometry = { ...GRID, scrollTop: 240 } // scrolled to noon
    expect(resolveDropSlot({ clientX: 100, clientY: 50 }, scrolled)).toEqual({
      dayIndex: 0,
      minutesFromMidnight: 720,
    })
  })

  it('returns null for a point outside the grid horizontally', () => {
    expect(resolveDropSlot({ clientX: 50, clientY: 50 }, GRID)).toBeNull()
    expect(resolveDropSlot({ clientX: 900, clientY: 50 }, GRID)).toBeNull()
  })

  it('returns null for a point outside the grid vertically', () => {
    expect(resolveDropSlot({ clientX: 100, clientY: 10 }, GRID)).toBeNull()
    expect(resolveDropSlot({ clientX: 100, clientY: 600 }, GRID)).toBeNull()
  })

  it('never returns a slot in the last-day final step overflowing midnight', () => {
    const result = resolveDropSlot({ clientX: 100, clientY: 50 + 479 }, GRID)
    expect(result?.minutesFromMidnight).toBeLessThanOrEqual(1440 - 30)
  })
})

describe('slotToInterval', () => {
  it('builds a start/end pair offset from the week anchor by day and minutes', () => {
    const weekAnchor = new Date(2026, 6, 13, 0, 0, 0, 0) // a Monday, local time
    const { start, end } = slotToInterval({ dayIndex: 2, minutesFromMidnight: 570 }, weekAnchor)

    expect(start.getDate()).toBe(15) // Monday + 2 days
    expect(start.getHours()).toBe(9)
    expect(start.getMinutes()).toBe(30)
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000)
  })

  it('supports a custom duration', () => {
    const weekAnchor = new Date(2026, 6, 13, 0, 0, 0, 0)
    const { start, end } = slotToInterval({ dayIndex: 0, minutesFromMidnight: 0 }, weekAnchor, 30)
    expect(end.getTime() - start.getTime()).toBe(30 * 60 * 1000)
  })
})
