// src/services/SoundService.js
// Simple beep sounds using Web Audio API (no external files needed)

class SoundService {
  constructor() {
    this.ctx = null
  }

  _getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    return this.ctx
  }

  // Short beep
  beep(freq = 800, duration = 0.15) {
    try {
      const ctx = this._getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.value = 0.3
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch (e) {}
  }

  // New order sound: 2 rising beeps
  orderSound() {
    this.beep(600, 0.12)
    setTimeout(() => this.beep(900, 0.15), 150)
  }

  // Payment success: pleasant ding
  paymentSound() {
    this.beep(1200, 0.1)
    setTimeout(() => this.beep(1500, 0.1), 100)
    setTimeout(() => this.beep(1800, 0.2), 200)
  }

  // Error / cancel
  errorSound() {
    this.beep(300, 0.2)
    setTimeout(() => this.beep(200, 0.3), 200)
  }

  // Button tap
  tapSound() {
    this.beep(1000, 0.05)
  }
}

export default new SoundService()
