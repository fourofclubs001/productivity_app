import { useEffect, useState } from 'react'
import { useIdleDetectionSettings } from '../../lib/useIdleDetectionSettings'

export default function ConfigDialog({ onClose }: { onClose: () => void }) {
  const { enabled, timeoutMinutes, setEnabled, setTimeoutMinutes } = useIdleDetectionSettings()
  // Local buffer so the field can be cleared and retyped -- coercing to a
  // valid integer on every keystroke (as the bound value) would snap an
  // emptied field straight back to its old number, making it impossible to
  // backspace and type a new one (same fix as v05's recurrence-interval
  // input).
  const [timeoutText, setTimeoutText] = useState(String(timeoutMinutes))

  useEffect(() => {
    setTimeoutText(String(timeoutMinutes))
  }, [timeoutMinutes])

  function commitTimeoutText() {
    const next = Math.max(1, Math.round(Number(timeoutText)) || 1)
    setTimeoutText(String(next))
    setTimeoutMinutes(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Configuration</h2>

        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Stop tracking after inactivity
        </label>
        <div className="mt-2 flex items-center gap-2 pl-6 text-sm text-text-secondary">
          <span>Timeout (minutes):</span>
          <input
            type="number"
            min={1}
            disabled={!enabled}
            value={timeoutText}
            onChange={(event) => setTimeoutText(event.target.value)}
            onBlur={commitTimeoutText}
            data-testid="idle-timeout-input"
            className="w-16 rounded border border-border bg-surface px-2 py-1 text-text-primary disabled:opacity-50"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
