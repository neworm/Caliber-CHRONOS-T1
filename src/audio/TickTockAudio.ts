/**
 * 100% Procedural Web Audio API Swiss Lever Escapement & Winding Ratchet Synthesizer.
 * Zero external audio files.
 */
export class TickTockAudio {
  private ctx: AudioContext | null = null;
  private enabled = false;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next && !this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (next && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Plays a crisp Swiss lever "tick" (polarity +1) or "tock" (polarity -1) acoustic impulse.
   */
  public playBeat(polarity: 1 | -1, amplitudeRatio = 1): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const gainScale = Math.max(0.15, Math.min(1, amplitudeRatio)) * 0.14;

    // 1. Primary escapement impulse metallic ping
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = polarity > 0 ? 4150 : 3780;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, now + 0.014);

    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.linearRampToValueAtTime(gainScale, now + 0.0012);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);

    // 2. Secondary drop/lock transient 6 ms later
    const lockOsc = this.ctx.createOscillator();
    const lockGain = this.ctx.createGain();
    lockOsc.type = 'sine';
    lockOsc.frequency.setValueAtTime(polarity > 0 ? 6400 : 5900, now + 0.005);
    lockGain.gain.setValueAtTime(0.0001, now + 0.005);
    lockGain.gain.linearRampToValueAtTime(gainScale * 0.55, now + 0.006);
    lockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);

    lockOsc.connect(lockGain);
    lockGain.connect(this.ctx.destination);
    lockOsc.start(now + 0.005);
    lockOsc.stop(now + 0.018);
  }

  /**
   * Plays a crisp mechanical ratchet click sequence when winding the crown.
   */
  public playWindClick(): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.042;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2400 + i * 160, t);
      osc.frequency.exponentialRampToValueAtTime(920, t + 0.015);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.02);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
