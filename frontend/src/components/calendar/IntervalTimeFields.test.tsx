import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultTimeValue, intervalTimeToDates, intervalToTimeValue } from './IntervalTimeFields'
import type { Interval } from '../../types'

describe('intervalTimeToDates', () => {
  it('combines independent start/end dates with their respective times', () => {
    const { start, end } = intervalTimeToDates({
      startDate: '2026-07-13',
      startTime: '23:00',
      endDate: '2026-07-14',
      endTime: '00:30',
    })

    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(6)
    expect(start.getDate()).toBe(13)
    expect(end.getDate()).toBe(14)
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('still supports a same-day interval when both dates match', () => {
    const { start, end } = intervalTimeToDates({
      startDate: '2026-07-13',
      startTime: '09:00',
      endDate: '2026-07-13',
      endTime: '10:00',
    })

    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000)
  })
})

describe('intervalToTimeValue', () => {
  it('derives independent start/end dates from a cross-midnight interval', () => {
    const interval: Interval = {
      id: 'i1',
      task_id: 't1',
      start: '2026-07-13T23:00:00.000Z',
      end: '2026-07-14T00:30:00.000Z',
      week_start: '2026-07-13',
    }

    const value = intervalToTimeValue(interval)
    const { start, end } = intervalTimeToDates(value)
    expect(start.toISOString()).toBe(interval.start)
    expect(end.toISOString()).toBe(interval.end)
  })
})

describe('defaultTimeValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('clamps the default 1-hour slot to stay same-day when the natural end would cross midnight', () => {
    vi.setSystemTime(new Date(2026, 6, 13, 22, 53, 0))

    const value = defaultTimeValue()

    expect(value.startDate).toBe(value.endDate)
    expect(value.startTime).toBe('23:00')
    expect(value.endTime).toBe('23:59')
  })

  it('uses a normal 1-hour default when it stays within the same day', () => {
    vi.setSystemTime(new Date(2026, 6, 13, 14, 10, 0))

    const value = defaultTimeValue()

    expect(value.startDate).toBe(value.endDate)
    expect(value.startTime).toBe('15:00')
    expect(value.endTime).toBe('16:00')
  })
})
