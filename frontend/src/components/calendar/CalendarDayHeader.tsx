import { format } from 'date-fns'

export default function CalendarDayHeader({ date }: { date: Date }) {
  return (
    <div className="calendar-day-header">
      <span className="day-name">{format(date, 'EEE')}</span>
      <span className="day-number">{format(date, 'd')}</span>
    </div>
  )
}
