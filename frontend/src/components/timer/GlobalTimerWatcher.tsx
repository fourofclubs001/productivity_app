import { useEffect, useState } from 'react'
import { useActiveTimer } from '../../api/timer'
import { applyFavicon, faviconState, formatFaviconLabel } from '../../lib/favicon'

const APP_TITLE = 'Productivity App'

// Always-mounted (in App.tsx, not inside ExecuteView/TimerControl) so the
// favicon and tab title keep reflecting timer state no matter which view is
// active -- the backend's active timer is a single global key that keeps
// running regardless of what's on screen, and TimerControl itself unmounts
// (along with anything it owned) the instant the user leaves Execute.
export default function GlobalTimerWatcher() {
  const { data: active } = useActiveTimer()

  // Elapsed-time tick for the favicon/title's live digits, mirroring
  // TimerControl.tsx's own identical per-second effect -- kept separate
  // (rather than shared) since TimerControl unmounts outside Execute while
  // this component must keep ticking regardless of which view is active.
  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    if (!active) {
      setElapsedMs(0)
      return undefined
    }
    const start = new Date(active.start).getTime()
    const update = () => setElapsedMs(Date.now() - start)
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [active])

  useEffect(() => {
    applyFavicon(faviconState(!!active))
  }, [active])

  useEffect(() => {
    document.title = active ? `${formatFaviconLabel(elapsedMs)} · ${APP_TITLE}` : APP_TITLE
  }, [active, elapsedMs])

  return null
}
