/**
 * The backend timestamps everything in UTC and computes week/day/month
 * boundaries in UTC. date-fns operates on local calendar fields with no
 * built-in UTC mode, so this shifts "now" by the local offset, making its
 * local fields (day-of-week, date, etc.) match the true UTC ones. Without
 * this, the frontend's notion of "today"/"this week" can diverge from the
 * backend's whenever local time and UTC fall on different calendar days.
 */
export function utcNow(): Date {
  const now = new Date()
  return new Date(now.getTime() + now.getTimezoneOffset() * 60_000)
}
