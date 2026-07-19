import { describe, expect, it, vi } from 'vitest'
import { computeDiffSegments, computeIntervalDiff } from './intervalDiff'
import type { Entry, Interval } from '../types'

const PLANNED = { start: new Date('2026-07-20T09:00:00Z'), end: new Date('2026-07-20T11:00:00Z') }

function at(hour: number, minute = 0) {
  return new Date(`2026-07-20T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`)
}

describe('computeIntervalDiff', () => {
  it('is entirely uncovered when there are no real ranges', () => {
    expect(computeIntervalDiff(PLANNED, [])).toEqual([
      { start: PLANNED.start, end: PLANNED.end, covered: false },
    ])
  })

  it('is entirely covered when a real range spans the whole planned interval', () => {
    const segments = computeIntervalDiff(PLANNED, [{ start: at(9), end: at(11) }])
    expect(segments).toEqual([{ start: PLANNED.start, end: PLANNED.end, covered: true }])
  })

  it('splits into covered + uncovered when overlap starts at the beginning', () => {
    const segments = computeIntervalDiff(PLANNED, [{ start: at(9), end: at(10) }])
    expect(segments).toEqual([
      { start: at(9), end: at(10), covered: true },
      { start: at(10), end: PLANNED.end, covered: false },
    ])
  })

  it('splits into uncovered + covered when overlap ends at the end', () => {
    const segments = computeIntervalDiff(PLANNED, [{ start: at(10), end: at(11) }])
    expect(segments).toEqual([
      { start: PLANNED.start, end: at(10), covered: false },
      { start: at(10), end: at(11), covered: true },
    ])
  })

  it('produces two uncovered gaps around a middle covered segment', () => {
    const middle = { start: at(9, 30), end: at(10) }
    const result = computeIntervalDiff(PLANNED, [middle])
    expect(result).toEqual([
      { start: PLANNED.start, end: middle.start, covered: false },
      { start: middle.start, end: middle.end, covered: true },
      { start: middle.end, end: PLANNED.end, covered: false },
    ])
  })

  it('merges disjoint real ranges before computing gaps', () => {
    const first = { start: at(9), end: at(9, 30) }
    const second = { start: at(10), end: at(10, 30) }
    const result = computeIntervalDiff(PLANNED, [second, first])
    expect(result).toEqual([
      { start: first.start, end: first.end, covered: true },
      { start: first.end, end: second.start, covered: false },
      { start: second.start, end: second.end, covered: true },
      { start: second.end, end: PLANNED.end, covered: false },
    ])
  })

  it('merges overlapping real ranges from multiple entries into one covered segment', () => {
    const first = { start: at(9), end: at(9, 45) }
    const second = { start: at(9, 30), end: at(10, 15) }
    const result = computeIntervalDiff(PLANNED, [first, second])
    expect(result).toEqual([
      { start: at(9), end: at(10, 15), covered: true },
      { start: at(10, 15), end: PLANNED.end, covered: false },
    ])
  })

  it('clips a real range that fully contains the planned interval to the planned bounds', () => {
    const containing = { start: at(8), end: at(12) }
    const result = computeIntervalDiff(PLANNED, [containing])
    expect(result).toEqual([{ start: PLANNED.start, end: PLANNED.end, covered: true }])
  })

  it('drops a zero-length segment when a real range ends exactly at the planned end', () => {
    const result = computeIntervalDiff(PLANNED, [{ start: at(9), end: at(11) }])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ start: PLANNED.start, end: PLANNED.end, covered: true })
  })
})

describe('computeDiffSegments', () => {
  const interval: Interval = {
    id: 'i1',
    task_id: 't1',
    start: PLANNED.start.toISOString(),
    end: PLANNED.end.toISOString(),
    week_start: '2026-07-20',
    task_name: null,
  }

  it('filters real entries to the matching task_id', () => {
    const unrelated: Entry = {
      id: 'e-unrelated',
      task_id: 'other-task',
      start: at(9).toISOString(),
      end: at(10).toISOString(),
      task_name: null,
    }
    const segments = computeDiffSegments([interval], [unrelated])
    expect(segments).toEqual([
      { start: PLANNED.start, end: PLANNED.end, covered: false, intervalId: 'i1', taskId: 't1' },
    ])
  })

  it('treats a still-running entry (end: null) as running until now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(at(10))
    const running: Entry = {
      id: 'e-running',
      task_id: 't1',
      start: at(9).toISOString(),
      end: null,
      task_name: null,
    }
    const segments = computeDiffSegments([interval], [running])
    expect(segments).toEqual([
      { start: PLANNED.start, end: at(10), covered: true, intervalId: 'i1', taskId: 't1' },
      { start: at(10), end: PLANNED.end, covered: false, intervalId: 'i1', taskId: 't1' },
    ])
    vi.useRealTimers()
  })
})
