export interface IdleDetectionSettings {
  enabled: boolean
  timeoutMinutes: number
}

const STORAGE_KEY = 'idle-detection-settings'
const DEFAULT_SETTINGS: IdleDetectionSettings = { enabled: false, timeoutMinutes: 10 }

function readSettings(): IdleDetectionSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_SETTINGS
    const parsed = JSON.parse(stored) as Partial<IdleDetectionSettings>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SETTINGS.enabled,
      timeoutMinutes:
        typeof parsed.timeoutMinutes === 'number' && parsed.timeoutMinutes > 0
          ? parsed.timeoutMinutes
          : DEFAULT_SETTINGS.timeoutMinutes,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// Module-level store, not per-component state: the Configuration dialog
// (writer) and GlobalTimerWatcher (reader) are separate components that both
// need the *same* live value in the same tab -- a plain useState per
// component (as useResizableWidth.ts uses) would leave the watcher holding a
// stale snapshot from mount until a full page reload.
let settings: IdleDetectionSettings = readSettings()
const listeners = new Set<() => void>()

export function getIdleDetectionSettings(): IdleDetectionSettings {
  return settings
}

export function setIdleDetectionSettings(next: Partial<IdleDetectionSettings>): void {
  settings = { ...settings, ...next }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  listeners.forEach((listener) => listener())
}

export function subscribeIdleDetectionSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
