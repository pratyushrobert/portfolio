/**
 * MimiOS System Audio Feedback Primitives
 *
 * Lightweight, non-blocking synthetic sound feedback via Web Audio API.
 * Never requests external assets, never throws if AudioContext is unsupported/suspended.
 */

export function playVolumeTick(volume: number = 80): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.04);

    const scaledGain = Math.max(0.001, (volume / 100) * 0.05);
    gain.gain.setValueAtTime(scaledGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 120);
  } catch {
    // Graceful silent fallback
  }
}

export function playToggleClick(enabled: boolean): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const targetFreq = enabled ? 720 : 420;
    osc.frequency.setValueAtTime(targetFreq, now);

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 100);
  } catch {
    // Graceful silent fallback
  }
}
