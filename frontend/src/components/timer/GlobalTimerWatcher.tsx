import { useEffect, useRef, useState } from 'react'
import { useActiveTimer, useStopTimer } from '../../api/timer'
import { useIdleDetectionSettings } from '../../lib/useIdleDetectionSettings'
import { playAlertTone } from '../../lib/playAlertTone'
import { applyFavicon, faviconState } from '../../lib/favicon'
import AlertDialog from '../common/AlertDialog'

const IDLE_EVENTS = ['keydown', 'mousedown', 'mousemove', 'wheel'] as const

interface IdleStopNotice {
  taskName: string
  timeoutMinutes: number
}

// Always-mounted (in App.tsx, not inside ExecuteView/TimerControl) so idle
// detection and the auto-stop notice keep working no matter which view is
// active -- the backend's active timer is a single global key that keeps
// running regardless of what's on screen, and TimerControl itself unmounts
// (along with any listener it owned) the instant the user leaves Execute.
export default function GlobalTimerWatcher() {
  const { data: active } = useActiveTimer()
  const stopTimer = useStopTimer()
  const { enabled, timeoutMinutes } = useIdleDetectionSettings()
  const [idleStopped, setIdleStopped] = useState<IdleStopNotice | null>(null)

  // Read via refs inside the timeout callback rather than as effect deps --
  // `active` gets a new query-data reference on every 5s poll and `stopTimer`
  // a new mutation-result object every render; depending on either directly
  // would tear down and rebuild the idle listeners/timer far more often than
  // the actual start/stop/setting transitions that should trigger it.
  const activeRef = useRef(active)
  activeRef.current = active
  const stopTimerRef = useRef(stopTimer)
  stopTimerRef.current = stopTimer

  useEffect(() => {
    if (!active?.id || !enabled) return undefined

    let timeoutId: ReturnType<typeof setTimeout>

    function fireIdleStop() {
      const current = activeRef.current
      if (!current) return
      playAlertTone()
      stopTimerRef.current.mutate(undefined, {
        onSuccess: () => {
          setIdleStopped({ taskName: current.task_name ?? current.task_id, timeoutMinutes })
        },
      })
    }

    function resetIdleTimer() {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(fireIdleStop, timeoutMinutes * 60_000)
    }

    resetIdleTimer()
    IDLE_EVENTS.forEach((event) => window.addEventListener(event, resetIdleTimer))

    return () => {
      clearTimeout(timeoutId)
      IDLE_EVENTS.forEach((event) => window.removeEventListener(event, resetIdleTimer))
    }
  }, [active?.id, enabled, timeoutMinutes])

  // Elapsed-time tick for the favicon's live digits, mirroring
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
    applyFavicon(faviconState(!!active, !!idleStopped), elapsedMs)
  }, [active, idleStopped, elapsedMs])

  if (!idleStopped) return null

  const { taskName, timeoutMinutes: minutes } = idleStopped
  return (
    <AlertDialog
      message={`Timer for "${taskName}" was stopped automatically after ${minutes} minute${
        minutes === 1 ? '' : 's'
      } of inactivity.`}
      onClose={() => setIdleStopped(null)}
    />
  )
}
