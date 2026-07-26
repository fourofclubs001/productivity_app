import { describe, expect, it } from 'vitest'
import { playAlertTone } from './playAlertTone'

describe('playAlertTone', () => {
  it('never throws, even without a usable AudioContext (e.g. under jsdom)', () => {
    expect(() => playAlertTone()).not.toThrow()
  })
})
