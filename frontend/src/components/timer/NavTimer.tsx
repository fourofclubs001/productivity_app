import { useEffect, useState } from 'react'
import { useActiveTimer } from '../../api/timer'
import { useTasks } from '../../api/tasks'
import { applyFavicon, faviconState, formatFaviconLabel } from '../../lib/favicon'
import Button from '../common/Button'
import StopTimerConfirmModal from './StopTimerConfirmModal'
import { useTimerStopFlow } from './useTimerStopFlow'

const APP_TITLE = 'Productivity App'

// The running-timer readout, mounted once in the nav bar (App.tsx). Also
// owns the favicon + tab-title side effects (formerly GlobalTimerWatcher) --
// the backend's active timer is a single global key that keeps running
// regardless of which view is on screen, so this component is always
// mounted and never inside a view.
export default function NavTimer() {
  const { data: active } = useActiveTimer()
  const { data: tasks = [] } = useTasks()
  const [elapsedMs, setElapsedMs] = useState(0)
  const stopFlow = useTimerStopFlow()

  useEffect(() => {
    if (!active) {
      setElapsedMs(0)
      return undefined
    }
    const start = new Date(active.start).getTime()
    const update = () => setElapsedMs(Date.now() - start)
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [active])

  useEffect(() => {
    applyFavicon(faviconState(!!active))
  }, [active])

  useEffect(() => {
    document.title = active ? `${formatFaviconLabel(elapsedMs)} · ${APP_TITLE}` : APP_TITLE
  }, [active, elapsedMs])

  if (!active) return null

  const task = tasks.find((t) => t.id === active.task_id)
  const taskName = task?.name ?? active.task_id

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
      <span className="text-text-secondary">Tracking</span>
      <strong className="max-w-[16ch] truncate text-text-primary">{taskName}</strong>
      <span className="font-mono tabular-nums text-text-primary">{formatFaviconLabel(elapsedMs)}</span>
      <Button
        variant="danger"
        size="sm"
        onClick={() =>
          stopFlow.request({
            taskId: active.task_id,
            taskName,
            definitionOfDone: task?.definition_of_done ?? '',
          })
        }
      >
        Stop
      </Button>
      {stopFlow.confirming && (
        <StopTimerConfirmModal
          taskName={stopFlow.confirming.taskName}
          definitionOfDone={stopFlow.confirming.definitionOfDone}
          isPending={stopFlow.isPending}
          onCancel={stopFlow.cancel}
          onStopOnly={stopFlow.stopOnly}
          onMarkDone={stopFlow.markDoneAndStop}
        />
      )}
    </div>
  )
}
