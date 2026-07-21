import { describe, expect, it } from 'vitest'
import { splitAcrossDays } from './splitEventAcrossDays'

describe('splitAcrossDays', () => {
  it('returns the event unchanged when start and end are on the same day', () => {
    const event = { start: new Date('2026-07-21T09:00:00'), end: new Date('2026-07-21T17:00:00') }
    expect(splitAcrossDays(event)).toEqual([event])
  })

  it('splits an event spanning one midnight into two day-clipped segments', () => {
    const event = { start: new Date('2026-07-21T22:00:00'), end: new Date('2026-07-22T02:00:00') }
    const segments = splitAcrossDays(event)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({ start: event.start, end: new Date('2026-07-22T00:00:00') })
    expect(segments[1]).toEqual({ start: new Date('2026-07-22T00:00:00'), end: event.end })
  })

  it('splits an event spanning multiple midnights into one segment per day', () => {
    const event = { start: new Date('2026-07-21T22:00:00'), end: new Date('2026-07-24T02:00:00') }
    const segments = splitAcrossDays(event)
    expect(segments).toHaveLength(4)
    expect(segments[0].start).toEqual(event.start)
    expect(segments[0].end).toEqual(new Date('2026-07-22T00:00:00'))
    expect(segments[1].start).toEqual(new Date('2026-07-22T00:00:00'))
    expect(segments[1].end).toEqual(new Date('2026-07-23T00:00:00'))
    expect(segments[2].start).toEqual(new Date('2026-07-23T00:00:00'))
    expect(segments[2].end).toEqual(new Date('2026-07-24T00:00:00'))
    expect(segments[3].start).toEqual(new Date('2026-07-24T00:00:00'))
    expect(segments[3].end).toEqual(event.end)
  })

  it('preserves extra fields on every segment', () => {
    const event = {
      start: new Date('2026-07-21T22:00:00'),
      end: new Date('2026-07-22T02:00:00'),
      id: 'abc',
      title: 'Deep work',
      colors: ['red'],
    }
    const segments = splitAcrossDays(event)
    expect(segments[0]).toMatchObject({ id: 'abc', title: 'Deep work', colors: ['red'] })
    expect(segments[1]).toMatchObject({ id: 'abc', title: 'Deep work', colors: ['red'] })
  })

  it('treats a zero-length or inverted range as a single, unsplit segment', () => {
    const event = { start: new Date('2026-07-22T00:00:00'), end: new Date('2026-07-21T23:00:00') }
    expect(splitAcrossDays(event)).toEqual([event])
  })
})
