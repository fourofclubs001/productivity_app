import { beforeEach, describe, expect, it } from 'vitest'
import {
  getIdleDetectionSettings,
  setIdleDetectionSettings,
  subscribeIdleDetectionSettings,
} from './idleDetectionSettings'

beforeEach(() => {
  window.localStorage.clear()
  setIdleDetectionSettings({ enabled: false, timeoutMinutes: 10 })
})

describe('idleDetectionSettings', () => {
  it('defaults to disabled with a 10 minute timeout', () => {
    expect(getIdleDetectionSettings()).toEqual({ enabled: false, timeoutMinutes: 10 })
  })

  it('persists updates to localStorage', () => {
    setIdleDetectionSettings({ enabled: true, timeoutMinutes: 5 })
    expect(getIdleDetectionSettings()).toEqual({ enabled: true, timeoutMinutes: 5 })
    expect(JSON.parse(window.localStorage.getItem('idle-detection-settings')!)).toEqual({
      enabled: true,
      timeoutMinutes: 5,
    })
  })

  it('notifies subscribers -- the mechanism that keeps the Configuration dialog and GlobalTimerWatcher in sync within one tab', () => {
    let notified = 0
    const unsubscribe = subscribeIdleDetectionSettings(() => {
      notified += 1
    })

    setIdleDetectionSettings({ enabled: true })
    expect(notified).toBe(1)

    unsubscribe()
    setIdleDetectionSettings({ enabled: false })
    expect(notified).toBe(1)
  })
})
