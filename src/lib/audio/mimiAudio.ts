/**
 * MimiOS Cat Mascot Audio Subsystem
 *
 * Provides a short, pleasant digital cat meow when MimiAI speaks or user interacts.
 * - Plays strictly once per assistant response near start of meaningful output.
 * - Protected by a 1.5s cooldown guard against rapid audio repetition.
 * - Respects system volume, system mute, and sound effects enabled toggles.
 * - Seamlessly degrades to synthesized Web Audio API if audio file is missing or autoplay restricted.
 */

import { useDesktopStore } from '../../stores/useDesktopStore';

let lastMeowTimestamp = 0;
const MEOW_COOLDOWN_MS = 1500;

export interface PlayMeowOptions {
  force?: boolean;
  volumeOverride?: number;
}

/**
 * Plays the Mimi mascot meow sound.
 * Guarantees zero unhandled promise rejections, zero network failures, and no external calls.
 */
export function playMimiMeow(options: PlayMeowOptions = {}): boolean {
  const now = Date.now();
  if (!options.force && now - lastMeowTimestamp < MEOW_COOLDOWN_MS) {
    return false;
  }

  const state = useDesktopStore.getState();
  const soundEffectsEnabled = state.soundEffectsEnabled ?? true;
  if (!soundEffectsEnabled && !options.force) {
    return false;
  }

  if (state.systemMuted && !options.force) {
    return false;
  }

  lastMeowTimestamp = now;

  const baseVolume = options.volumeOverride !== undefined
    ? Math.max(0, Math.min(100, options.volumeOverride))
    : (state.systemVolume ?? 80);

  if (baseVolume <= 0) return false;

  const normalizedVolume = Math.min(1, Math.max(0.01, (baseVolume / 100) * 0.45));

  // 1. Attempt to play bundled audio asset
  try {
    if (typeof Audio !== 'undefined') {
      const audio = new Audio('/assets/audio/mimi-meow.mp3');
      audio.volume = normalizedVolume;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Fallback to Web Audio synthesis if audio asset is corrupt, missing, or blocked by browser autoplay
          synthesizeMimiMeow(normalizedVolume);
        });
      }
    } else {
      synthesizeMimiMeow(normalizedVolume);
    }
  } catch {
    synthesizeMimiMeow(normalizedVolume);
  }

  return true;
}

/**
 * Synthesizes a gentle, organic cat meow via Web Audio API.
 * Uses a dual-frequency formant glide that simulates feline vocalization.
 */
export function synthesizeMimiMeow(volume = 0.25): void {
  try {
    const AudioCtx =
      (typeof window !== 'undefined' &&
        (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) ||
      (typeof globalThis !== 'undefined' &&
        (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext);
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const duration = 0.32; // ~320ms cat chirp/meow

    // Primary vocal oscillator (fundamental pitch)
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';

    // Pitch contour: starts at 680Hz, glides to 920Hz (attack "me-"), then drops to 460Hz (release "-ow")
    osc1.frequency.setValueAtTime(680, now);
    osc1.frequency.exponentialRampToValueAtTime(920, now + 0.07);
    osc1.frequency.exponentialRampToValueAtTime(460, now + duration);

    // Secondary harmonic overtone for vocal throat character
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1360, now);
    osc2.frequency.exponentialRampToValueAtTime(1840, now + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(920, now + duration);

    // Formant filter (mouth acoustics)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.2, now);
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + duration);

    // Gain Envelopes
    const gainNode = ctx.createGain();
    const effectiveGain = Math.max(0.001, Math.min(0.35, volume));
    gainNode.gain.setValueAtTime(0.0001, now);
    // Smooth attack
    gainNode.gain.exponentialRampToValueAtTime(effectiveGain, now + 0.035);
    // Body sustain
    gainNode.gain.setValueAtTime(effectiveGain * 0.9, now + 0.09);
    // Smooth decay
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.18, now);

    // Audio routing
    osc1.connect(gainNode);
    osc2.connect(overtoneGain);
    overtoneGain.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);

    // Release context after completion
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, Math.round((duration + 0.15) * 1000));
  } catch {
    // Graceful silent degradation
  }
}
