import { useEffect, useState } from 'react'
import type { Task } from '../../types'
import { useActiveTimer, useStartTimer } from '../../api/timer'
import { formatFaviconLabel } from '../../lib/favicon'
import Button from '../common/Button'
import AlertDialog from '../common/AlertDialog'
import StopTimerConfirmModal from './StopTimerConfirmModal'
import { useTimerStopFlow } from './useTimerStopFlow'

// Start / stop time-tracking for a leaf task straight from its detail panel
// (v08 item 5). Replaces the old Execute-view task picker + Start button.
export default function TaskTimerButton({ task }: { task: Task }) {
  const { data: active } = useActiveTimer()
  const startTimer = useStartTimer()
  const stopFlow = useTimerStopFlow()
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const isTracking = active?.task_id === task.id
  const isFinished = task.state === 'sprint_done' || task.state === 'done'

  useEffect(() => {
    if (!isTracking || !active) {
      setElapsedMs(0)
      return undefined
    }
    const start = new Date(active.start).getTime()
    const update = () => setElapsedMs(Date.now() - start)
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [isTracking, active])

  if (!isTracking && isFinished) return null

  return (
    <>
      {isTracking ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() =>
            stopFlow.request({
              taskId: task.id,
              taskName: task.name,
              definitionOfDone: task.definition_of_done,
            })
          }
        >
          Stop timer · <span className="font-mono tabular-nums">{formatFaviconLabel(elapsedMs)}</span>
        </Button>
      ) : (
        <Button
          variant="success"
          size="sm"
          disabled={startTimer.isPending || Boolean(active)}
          title={active ? 'Another task is being tracked' : undefined}
          onClick={() =>
            startTimer.mutate(task.id, {
              onError: (error) => setAlertMessage((error as Error).message),
            })
          }
        >
          Start timer
        </Button>
      )}
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
      {alertMessage && <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />}
    </>
  )
}
