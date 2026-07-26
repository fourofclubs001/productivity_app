// A short generated beep, so a user who's present but not actively
// typing/clicking notices the timer was auto-stopped. No audio asset file --
// best-effort only, since a failed/unsupported tone should never break the
// auto-stop flow itself.
export function playAlertTone(): void {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.4)
    oscillator.onended = () => ctx.close()
  } catch {
    // best-effort, see above
  }
}
