import { describe, expect, it } from 'vitest'
import { resolveFirstOccurrenceDate } from './recurrenceResolve'

function d(iso: string): Date {
  return new Date(iso)
}

describe('resolveFirstOccurrenceDate', () => {
  it('non-weekly units always resolve to the anchor itself', () => {
    const anchor = d('2026-07-23T09:00:00') // Thursday
    expect(resolveFirstOccurrenceDate(anchor, 1, 'day', [])).toEqual(anchor)
    expect(resolveFirstOccurrenceDate(anchor, 1, 'month', [])).toEqual(anchor)
    expect(resolveFirstOccurrenceDate(anchor, 1, 'year', [])).toEqual(anchor)
  })

  it('weekly with no days selected defaults to the anchor (its own weekday)', () => {
    const anchor = d('2026-07-23T09:00:00') // Thursday
    expect(resolveFirstOccurrenceDate(anchor, 1, 'week', []).toDateString()).toEqual(
      anchor.toDateString(),
    )
  })

  it('weekly with the anchor already on a selected day resolves to the anchor', () => {
    const anchor = d('2026-07-23T09:00:00') // Thursday = weekday 3
    expect(resolveFirstOccurrenceDate(anchor, 1, 'week', [3]).toDateString()).toEqual(
      anchor.toDateString(),
    )
  })

  it('weekly with an earlier-in-week day selected rolls forward to next week (item 11 repro)', () => {
    const anchor = d('2026-07-23T09:00:00') // Thursday
    const resolved = resolveFirstOccurrenceDate(anchor, 1, 'week', [0]) // Monday only
    expect(resolved.toDateString()).toEqual(d('2026-07-27T09:00:00').toDateString()) // next Monday
  })

  it('weekly with a later-in-week day selected resolves within the same week', () => {
    const anchor = d('2026-07-23T09:00:00') // Thursday
    const resolved = resolveFirstOccurrenceDate(anchor, 1, 'week', [5]) // Saturday
    expect(resolved.toDateString()).toEqual(d('2026-07-25T09:00:00').toDateString())
  })

  it('biweekly rolls to the next eligible week when the anchor week is skipped', () => {
    // Anchor is a Thursday, but only Monday is selected and the interval
    // is 2 -- the anchor's own week (week 0) is eligible (0 % 2 == 0), but
    // Monday of that week is *before* the anchor, so it must roll to the
    // next eligible week (week 2, since week 1 is skipped by the interval).
    const anchor = d('2026-07-23T09:00:00') // Thursday
    const resolved = resolveFirstOccurrenceDate(anchor, 2, 'week', [0])
    expect(resolved.toDateString()).toEqual(d('2026-08-03T09:00:00').toDateString())
  })
})
