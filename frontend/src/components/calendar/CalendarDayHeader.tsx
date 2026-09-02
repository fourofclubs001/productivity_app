import { format, isSameDay } from 'date-fns'
import { utcNow } from '../../lib/time'

// Stacked day header: "MON" above the date number. Today's date-number sits
// in an accent circle (Google Calendar style) instead of the whole column
// being tinted (v08 UX-17).
export default function CalendarDayHeader({ date }: { date: Date }) {
  const isToday = isSameDay(date, utcNow())
  return (
    <div className="calendar-day-header">
      <span className={`day-name ${isToday ? 'is-today' : ''}`}>{format(date, 'EEE')}</span>
      <span className={`day-number ${isToday ? 'is-today' : ''}`}>{format(date, 'd')}</span>
    </div>
  )
}
