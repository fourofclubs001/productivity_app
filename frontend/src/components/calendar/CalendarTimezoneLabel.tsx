import { getTimezoneLabel } from './timezone'

export default function CalendarTimezoneLabel() {
  return <div className="calendar-timezone-label">{getTimezoneLabel()}</div>
}
