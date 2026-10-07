/**
 * MimiOS Boot Audio Subsystem
 *
 * Plays startup audio on machine power-on.
 * Gracefully degrades if audio file is missing or autoplay is restricted.
 */

export function playBootChime(): void {
  // 1. Try dedicated audio asset
  try {
    const audio = new Audio('/assets/audio/boot-startup-placeholder.mp3');
    audio.volume = 0.35;
    const promise = audio.play();
    if (promise) {
      promise.catch(() => {
        // Fall back to synthesized gentle chime
        synthesizeBootChime();
      });
    }
  } catch {
    synthesizeBootChime();
  }
}

/**
 * Synthesizes a clean, subtle hardware boot chime via Web Audio API.
 * Never crashes even if AudioContext is unsupported.
 */
function synthesizeBootChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const frequencies = [261.63, 392.00, 523.25]; // C4, G4, C5 subtle harmonic triad

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.04, now + idx * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6 + idx * 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + 0.7);
    });

    // Close audio context after chime finishes to release hardware
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Graceful degradation: silent fallback
  }
}
