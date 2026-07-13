export function getTimezoneLabel(): string {
  const offsetMinutes = -new Date().getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const hours = Math.floor(Math.abs(offsetMinutes) / 60)
  return `GMT${sign}${hours}`
}
