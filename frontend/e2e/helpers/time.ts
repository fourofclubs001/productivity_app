/**
 * A time "today" (UTC) at the given hour, pushed forward to a safely-future
 * moment if that hour has already passed -- avoids colliding with the
 * backend's "no past-dated intervals" guard (v02 item 8) regardless of what
 * time of day the test suite happens to run.
 */
export function todayAt(hours: number): Date {
  const now = new Date()
  const date = new Date(now)
  date.setUTCHours(hours, 0, 0, 0)
  if (date.getTime() <= now.getTime()) {
    date.setTime(now.getTime() + 30 * 60 * 1000)
    date.setUTCSeconds(0, 0)
  }
  return date
}
