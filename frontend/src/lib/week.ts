import { addWeeks, format, startOfWeek } from 'date-fns'

export function mondayOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function weekStartKey(date: Date): string {
  return format(mondayOf(date), 'yyyy-MM-dd')
}

export function shiftWeek(date: Date, delta: number): Date {
  return addWeeks(date, delta)
}

export function formatWeekLabel(date: Date): string {
  return format(date, 'MMM d, yyyy')
}
