interface TimeRange {
  start: Date
  end: Date
}

/** Fully elapsed: both start and end are before now. */
export function isFullyPast(range: TimeRange, now: Date): boolean {
  return range.end <= now
}

/** now falls inside the range: start has passed but end hasn't. */
export function isInProgress(range: TimeRange, now: Date): boolean {
  return range.start <= now && now < range.end
}

/** Not yet started: start is still ahead of now. */
export function isFullyFuture(range: TimeRange, now: Date): boolean {
  return range.start > now
}
