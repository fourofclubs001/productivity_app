import { describe, expect, it } from 'vitest'
import { isFullyFuture, isFullyPast, isInProgress } from './intervalTiming'

const now = new Date('2026-07-14T12:00:00Z')

describe('intervalTiming', () => {
  it('classifies a fully-past range', () => {
    const range = { start: new Date('2026-07-14T09:00:00Z'), end: new Date('2026-07-14T10:00:00Z') }
    expect(isFullyPast(range, now)).toBe(true)
    expect(isInProgress(range, now)).toBe(false)
    expect(isFullyFuture(range, now)).toBe(false)
  })

  it('classifies a range ending exactly at now as fully past (end is exclusive)', () => {
    const range = { start: new Date('2026-07-14T11:00:00Z'), end: new Date('2026-07-14T12:00:00Z') }
    expect(isFullyPast(range, now)).toBe(true)
    expect(isInProgress(range, now)).toBe(false)
  })

  it('classifies a range with now inside it as in-progress', () => {
    const range = { start: new Date('2026-07-14T11:00:00Z'), end: new Date('2026-07-14T13:00:00Z') }
    expect(isFullyPast(range, now)).toBe(false)
    expect(isInProgress(range, now)).toBe(true)
    expect(isFullyFuture(range, now)).toBe(false)
  })

  it('classifies a range starting exactly at now as in-progress (start is inclusive)', () => {
    const range = { start: new Date('2026-07-14T12:00:00Z'), end: new Date('2026-07-14T13:00:00Z') }
    expect(isInProgress(range, now)).toBe(true)
    expect(isFullyFuture(range, now)).toBe(false)
  })

  it('classifies a fully-future range', () => {
    const range = { start: new Date('2026-07-14T13:00:00Z'), end: new Date('2026-07-14T14:00:00Z') }
    expect(isFullyPast(range, now)).toBe(false)
    expect(isInProgress(range, now)).toBe(false)
    expect(isFullyFuture(range, now)).toBe(true)
  })
})
