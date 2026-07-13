import { addDays, addMonths, addWeeks, format, startOfDay, startOfMonth } from 'date-fns'
import { mondayOf } from './week'
import { utcNow } from './time'

export type Granularity = 'day' | 'week' | 'month'

export function periodAnchorKey(granularity: Granularity, date: Date): string {
  if (granularity === 'day') return format(startOfDay(date), 'yyyy-MM-dd')
  if (granularity === 'week') return format(mondayOf(date), 'yyyy-MM-dd')
  return format(startOfMonth(date), 'yyyy-MM-dd')
}

export function shiftPeriod(granularity: Granularity, date: Date, delta: number): Date {
  if (granularity === 'day') return addDays(date, delta)
  if (granularity === 'week') return addWeeks(date, delta)
  return addMonths(date, delta)
}

export function formatPeriodLabel(granularity: Granularity, date: Date): string {
  if (granularity === 'day') return format(date, 'MMM d, yyyy')
  if (granularity === 'week') return `Week of ${format(mondayOf(date), 'MMM d, yyyy')}`
  return format(date, 'MMMM yyyy')
}

export function isCurrentPeriod(granularity: Granularity, date: Date): boolean {
  return periodAnchorKey(granularity, date) === periodAnchorKey(granularity, utcNow())
}
