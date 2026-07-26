import { useSyncExternalStore } from 'react'
import {
  getIdleDetectionSettings,
  setIdleDetectionSettings,
  subscribeIdleDetectionSettings,
} from './idleDetectionSettings'

export function useIdleDetectionSettings() {
  const settings = useSyncExternalStore(subscribeIdleDetectionSettings, getIdleDetectionSettings)

  return {
    ...settings,
    setEnabled: (enabled: boolean) => setIdleDetectionSettings({ enabled }),
    setTimeoutMinutes: (timeoutMinutes: number) => setIdleDetectionSettings({ timeoutMinutes }),
  }
}
