import { describe, expect, it } from 'vitest'
import {
  isFullyFuture,
  isFullyPast,
  isInProgress,
  resolveDragRescheduleAction,
} from './intervalTiming'

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

describe('resolveDragRescheduleAction', () => {
  it('is a plain update for a fully-future chip', () => {
    const previous = { start: new Date('2026-07-14T13:00:00Z'), end: new Date('2026-07-14T14:00:00Z') }
    const newStart = new Date('2026-07-14T15:00:00Z')
    expect(resolveDragRescheduleAction(previous, newStart, now)).toEqual({ type: 'update' })
  })

  it('is a plain update when the start is unchanged (e.g. resizing the end only)', () => {
    const previous = { start: new Date('2026-07-14T09:00:00Z'), end: new Date('2026-07-14T10:00:00Z') }
    expect(resolveDragRescheduleAction(previous, previous.start, now)).toEqual({ type: 'update' })
  })

  it('creates a copy when a fully-past chip is dragged to a future start', () => {
    const previous = { start: new Date('2026-07-14T09:00:00Z'), end: new Date('2026-07-14T10:00:00Z') }
    const newStart = new Date('2026-07-15T09:00:00Z')
    expect(resolveDragRescheduleAction(previous, newStart, now)).toEqual({ type: 'create' })
  })

  it('creates a copy when an in-progress chip is dragged to a future start', () => {
    const previous = { start: new Date('2026-07-14T11:00:00Z'), end: new Date('2026-07-14T13:00:00Z') }
    const newStart = new Date('2026-07-14T15:00:00Z')
    expect(resolveDragRescheduleAction(previous, newStart, now)).toEqual({ type: 'create' })
  })

  it('rejects dragging a locked chip to another past slot -- no backdating', () => {
    const previous = { start: new Date('2026-07-14T09:00:00Z'), end: new Date('2026-07-14T10:00:00Z') }
    const newStart = new Date('2026-07-14T08:00:00Z')
    const result = resolveDragRescheduleAction(previous, newStart, now)
    expect(result.type).toBe('reject')
  })

  it('rejects moving an in-progress chip fully into the past', () => {
    const previous = { start: new Date('2026-07-14T11:00:00Z'), end: new Date('2026-07-14T13:00:00Z') }
    const newStart = new Date('2026-07-14T10:00:00Z')
    const result = resolveDragRescheduleAction(previous, newStart, now)
    expect(result.type).toBe('reject')
  })
})
