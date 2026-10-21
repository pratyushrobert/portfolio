import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Polyfill localStorage and window in Node test environment
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, val: string) => {
    store.set(key, String(val));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
  length: 0,
  key: () => null,
} as Storage;

const windowMock = {
  innerWidth: 1024,
  innerHeight: 768,
  localStorage: fakeStorage,
  matchMedia: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// @ts-expect-error Node global polyfill
globalThis.localStorage = fakeStorage;
// @ts-expect-error Node global polyfill
global.localStorage = fakeStorage;

// @ts-expect-error Node global polyfill
globalThis.window = windowMock;
// @ts-expect-error Node global polyfill
global.window = windowMock;

import { useMascotStore, GUIDE_STEPS, type MimiMood } from '../stores/useMascotStore';
import { useDesktopStore } from '../stores/useDesktopStore';
import { playMimiMeow, synthesizeMimiMeow } from '../lib/audio/mimiAudio';

describe('Mimi Pixel Cat Mascot & Guide System', () => {
  beforeEach(() => {
    localStorage.clear();
    useMascotStore.setState({
      mood: 'idle',
      isCompanionOpen: false,
      isGuideActive: false,
      guideStepIndex: 0,
      hasCompletedGuide: false,
      isDismissed: false,
      companionPosition: null,
      moodTimeoutId: null,
    });
    useDesktopStore.setState({
      mascotEnabled: true,
      soundEffectsEnabled: true,
      systemVolume: 80,
      systemMuted: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Mascot States & Moods', () => {
    const requiredMoods: MimiMood[] = [
      'idle',
      'walking',
      'looking_around',
      'greeting',
      'talking',
      'thinking',
      'happy',
      'confused',
      'sleeping',
    ];

    it('supports all 9 required mascot mood states', () => {
      const store = useMascotStore.getState();
      expect(store.mood).toBe('idle');

      for (const mood of requiredMoods) {
        useMascotStore.getState().setMood(mood);
        expect(useMascotStore.getState().mood).toBe(mood);
      }
    });

    it('handles temporary mood with automatic revert timeout', () => {
      vi.useFakeTimers();
      useMascotStore.getState().setMoodWithTimeout('happy', 1000, 'idle');
      expect(useMascotStore.getState().mood).toBe('happy');

      vi.advanceTimersByTime(1050);
      expect(useMascotStore.getState().mood).toBe('idle');
      vi.useRealTimers();
    });

    it('cancels previous mood timeout when a new mood is set', () => {
      vi.useFakeTimers();
      useMascotStore.getState().setMoodWithTimeout('thinking', 2000, 'idle');
      expect(useMascotStore.getState().mood).toBe('thinking');

      useMascotStore.getState().setMood('confused');
      expect(useMascotStore.getState().mood).toBe('confused');

      vi.advanceTimersByTime(2500);
      expect(useMascotStore.getState().mood).toBe('confused');
      vi.useRealTimers();
    });
  });

  describe('Interactive Tour Guide (7 Required Steps)', () => {
    it('defines exactly 7 comprehensive interactive steps covering all required systems', () => {
      expect(GUIDE_STEPS).toHaveLength(7);

      const stepIds = GUIDE_STEPS.map(s => s.id);
      expect(stepIds).toEqual([
        'desktop_launcher',
        'terminal_commands',
        'file_manager',
        'portfolio_projects',
        'mimi_ai',
        'settings_personalization',
        'cyber_simulations',
      ]);
    });

    it('navigates forward through guide steps and updates mood accordingly', () => {
      useMascotStore.getState().startGuide();
      expect(useMascotStore.getState().isGuideActive).toBe(true);
      expect(useMascotStore.getState().guideStepIndex).toBe(0);
      expect(useMascotStore.getState().mood).toBe(GUIDE_STEPS[0].mood);

      // Step 1: Terminal
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(1);
      expect(useMascotStore.getState().mood).toBe(GUIDE_STEPS[1].mood);

      // Step 2: File Manager
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(2);
      expect(useMascotStore.getState().mood).toBe(GUIDE_STEPS[2].mood);

      // Step 3: Projects
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(3);

      // Step 4: MimiAI
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(4);

      // Step 5: Settings
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(5);

      // Step 6: Cyber simulations
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(6);
    });

    it('navigates backward through guide steps', () => {
      useMascotStore.getState().startGuide();
      useMascotStore.getState().nextGuideStep();
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(2);

      useMascotStore.getState().prevGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(1);

      useMascotStore.getState().prevGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(0);

      // Cannot go below step 0
      useMascotStore.getState().prevGuideStep();
      expect(useMascotStore.getState().guideStepIndex).toBe(0);
    });

    it('finishes guide on last step and records completion in localStorage', () => {
      useMascotStore.getState().startGuide();
      for (let i = 0; i < 6; i++) {
        useMascotStore.getState().nextGuideStep();
      }
      expect(useMascotStore.getState().guideStepIndex).toBe(6);

      // Advancing from step 6 triggers finishGuide
      useMascotStore.getState().nextGuideStep();
      expect(useMascotStore.getState().isGuideActive).toBe(false);
      expect(useMascotStore.getState().hasCompletedGuide).toBe(true);
      expect(localStorage.getItem('mimi_guide_completed')).toBe('true');
    });

    it('skips guide and records completion without locking user in tour', () => {
      useMascotStore.getState().startGuide();
      useMascotStore.getState().skipGuide();
      expect(useMascotStore.getState().isGuideActive).toBe(false);
      expect(useMascotStore.getState().hasCompletedGuide).toBe(true);
      expect(localStorage.getItem('mimi_guide_completed')).toBe('true');
    });

    it('allows restarting guide anytime via resetGuide', () => {
      useMascotStore.getState().finishGuide();
      expect(useMascotStore.getState().hasCompletedGuide).toBe(true);

      useMascotStore.getState().resetGuide();
      expect(useMascotStore.getState().isGuideActive).toBe(true);
      expect(useMascotStore.getState().guideStepIndex).toBe(0);
      expect(useMascotStore.getState().isCompanionOpen).toBe(true);
    });
  });

  describe('Companion Visibility & Settings', () => {
    it('supports showing and hiding mascot via useDesktopStore', () => {
      expect(useDesktopStore.getState().mascotEnabled).toBe(true);

      useDesktopStore.getState().setMascotEnabled(false);
      expect(useDesktopStore.getState().mascotEnabled).toBe(false);

      useDesktopStore.getState().setMascotEnabled(true);
      expect(useDesktopStore.getState().mascotEnabled).toBe(true);
    });

    it('supports temporary dismissal and stores preference', () => {
      expect(useMascotStore.getState().isDismissed).toBe(false);

      useMascotStore.getState().setIsDismissed(true);
      expect(useMascotStore.getState().isDismissed).toBe(true);
      expect(localStorage.getItem('mimi_companion_dismissed')).toBe('true');

      useMascotStore.getState().setIsDismissed(false);
      expect(useMascotStore.getState().isDismissed).toBe(false);
      expect(localStorage.getItem('mimi_companion_dismissed')).toBeNull();
    });

    it('allows toggling companion flyout panel open and closed', () => {
      expect(useMascotStore.getState().isCompanionOpen).toBe(false);

      useMascotStore.getState().toggleCompanion();
      expect(useMascotStore.getState().isCompanionOpen).toBe(true);

      useMascotStore.getState().toggleCompanion();
      expect(useMascotStore.getState().isCompanionOpen).toBe(false);
    });
  });

  describe('Meow Audio System & Guards', () => {
    it('respects soundEffectsEnabled setting', () => {
      useDesktopStore.getState().setSoundEffectsEnabled(false);
      const played = playMimiMeow();
      expect(played).toBe(false);
    });

    it('respects systemMuted state', () => {
      useDesktopStore.getState().setSoundEffectsEnabled(true);
      useDesktopStore.setState({ systemMuted: true });
      const played = playMimiMeow();
      expect(played).toBe(false);
    });

    it('enforces cooldown guard preventing rapid audio spamming', () => {
      useDesktopStore.getState().setSoundEffectsEnabled(true);
      useDesktopStore.setState({ systemMuted: false });

      const firstPlay = playMimiMeow({ force: true });
      expect(firstPlay).toBe(true);

      // Immediate second attempt within 1500ms should be blocked by cooldown guard
      const secondPlay = playMimiMeow();
      expect(secondPlay).toBe(false);

      // Forced playback bypasses cooldown
      const forcedPlay = playMimiMeow({ force: true });
      expect(forcedPlay).toBe(true);
    });

    it('synthesizeMimiMeow runs safely without throwing even without DOM AudioContext', () => {
      expect(() => {
        synthesizeMimiMeow(0.3);
      }).not.toThrow();
    });
  });

  describe('Contextual Speech Bubbles', () => {
    it('sets speech bubble with text and automatically dismisses after timeout', () => {
      vi.useFakeTimers();
      useMascotStore.getState().speak('Mrrp! Want me to show you around?', { durationMs: 4000 });

      const bubble = useMascotStore.getState().speechBubble;
      expect(bubble).not.toBeNull();
      expect(bubble?.text).toBe('Mrrp! Want me to show you around?');

      vi.advanceTimersByTime(4050);
      expect(useMascotStore.getState().speechBubble).toBeNull();
      vi.useRealTimers();
    });

    it('manually dismisses speech bubble with dismissSpeechBubble', () => {
      useMascotStore.getState().speak('Testing manual dismissal');
      expect(useMascotStore.getState().speechBubble).not.toBeNull();

      useMascotStore.getState().dismissSpeechBubble();
      expect(useMascotStore.getState().speechBubble).toBeNull();
    });

    it('replaces active speech bubble cleanly when speak is called again', () => {
      useMascotStore.getState().speak('First message');
      expect(useMascotStore.getState().speechBubble?.text).toBe('First message');

      useMascotStore.getState().speak('Second message');
      expect(useMascotStore.getState().speechBubble?.text).toBe('Second message');
    });
  });

  describe('Mascot Dismissal Without Guilt or Interruption', () => {
    it('dismissMascot immediately sets isDismissed, disables desktop mascot, and clears speech without guilt dialogs', () => {
      useMascotStore.getState().speak('I am talking right now');
      useMascotStore.getState().setCompanionOpen(true);
      expect(useDesktopStore.getState().mascotEnabled).toBe(true);

      useMascotStore.getState().dismissMascot();

      expect(useMascotStore.getState().isDismissed).toBe(true);
      expect(useDesktopStore.getState().mascotEnabled).toBe(false);
      expect(useMascotStore.getState().isCompanionOpen).toBe(false);
      expect(useMascotStore.getState().speechBubble).toBeNull();
      expect(localStorage.getItem('mimi_companion_dismissed')).toBe('true');
    });

    it('showMascot restores visibility and synchronizes desktop store', () => {
      useMascotStore.getState().dismissMascot();
      expect(useDesktopStore.getState().mascotEnabled).toBe(false);

      useMascotStore.getState().showMascot();
      expect(useMascotStore.getState().isDismissed).toBe(false);
      expect(useDesktopStore.getState().mascotEnabled).toBe(true);
      expect(localStorage.getItem('mimi_companion_dismissed')).toBeNull();
    });
  });

  describe('Animated App Navigation with Paws', () => {
    it('navigates to app with prefers-reduced-motion by jumping directly and tapping paw', async () => {
      // Mock prefers-reduced-motion: true
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const result = await useMascotStore.getState().navigateToApp('terminal');
      expect(result).toBe(true);
      expect(useMascotStore.getState().mood).toBe('idle');
      expect(useMascotStore.getState().speechBubble?.text).toContain('All done');
    });

    it('opens application directly if mascot is disabled', async () => {
      useDesktopStore.getState().setMascotEnabled(false);
      const result = await useMascotStore.getState().navigateToApp('files');
      expect(result).toBe(true);
    });
  });

  describe('Terminal Mascot Management Commands', () => {
    it('supports mimi hide, close, dismiss, show, and toggle', async () => {
      const { mimiCommand } = await import('../lib/terminal/commands/mimi');

      // Hide
      const hideResult = await mimiCommand.handler(['hide']);
      expect(hideResult).toContain('Mimi mascot hidden');
      expect(useDesktopStore.getState().mascotEnabled).toBe(false);

      // Show
      const showResult = await mimiCommand.handler(['show']);
      expect(showResult).toContain('Mimi mascot restored');
      expect(useDesktopStore.getState().mascotEnabled).toBe(true);

      // Close
      const closeResult = await mimiCommand.handler(['close']);
      expect(closeResult).toContain('Mimi mascot hidden');
      expect(useDesktopStore.getState().mascotEnabled).toBe(false);

      // Toggle
      await mimiCommand.handler(['toggle']);
      expect(useDesktopStore.getState().mascotEnabled).toBe(true);
    });

    it('supports close mascot command', async () => {
      const { closeCommand } = await import('../lib/terminal/commands/close');

      useDesktopStore.getState().setMascotEnabled(true);
      const res = await closeCommand.handler(['mascot']);
      expect(res).toContain('Mimi mascot dismissed');
      expect(useDesktopStore.getState().mascotEnabled).toBe(false);
    });
  });

  describe('Global Glass Blur Default 5px Verification', () => {
    it('defaults to 5px in useDesktopStore', () => {
      expect(useDesktopStore.getState().glassBlur).toBe(5);
    });

    it('clamps values between 0 and 30', () => {
      useDesktopStore.getState().setGlassBlur(45);
      expect(useDesktopStore.getState().glassBlur).toBe(30);

      useDesktopStore.getState().setGlassBlur(-10);
      expect(useDesktopStore.getState().glassBlur).toBe(0);

      useDesktopStore.getState().setGlassBlur(5);
      expect(useDesktopStore.getState().glassBlur).toBe(5);
    });
  });

  describe('Natural Language App Request Parser', () => {
    it('accurately parses direct and conversational app open requests', async () => {
      const { parseNaturalLanguageAppRequest } = await import('../lib/ai/actions');

      expect(parseNaturalLanguageAppRequest('Mimi, open Terminal.')).toEqual({
        action: 'open_app',
        appId: 'terminal',
        appName: 'Terminal',
      });

      expect(parseNaturalLanguageAppRequest('Show me About Me')).toEqual({
        action: 'open_app',
        appId: 'about',
        appName: 'About Me',
      });

      expect(parseNaturalLanguageAppRequest('take me to projects')).toEqual({
        action: 'open_app',
        appId: 'projects',
        appName: 'Projects',
      });

      expect(parseNaturalLanguageAppRequest('Open File Manager')).toEqual({
        action: 'open_app',
        appId: 'files',
        appName: 'File Manager',
      });

      expect(parseNaturalLanguageAppRequest('can you please launch settings?')).toEqual({
        action: 'open_app',
        appId: 'settings',
        appName: 'Settings',
      });

      expect(parseNaturalLanguageAppRequest('start snake game')).toEqual({
        action: 'open_app',
        appId: 'snake',
        appName: 'Cyber Snake',
      });

      expect(parseNaturalLanguageAppRequest('what is the weather today?')).toBeNull();
      expect(parseNaturalLanguageAppRequest('')).toBeNull();
    });
  });

  describe('Live DOM Target Lookup and Facing Direction', () => {
    it('resolves coordinates using live DOM elements and sets travel facing direction', async () => {
      const { findAppTargetCoordinates } = await import('../stores/useMascotStore');

      const originalDoc = (globalThis as unknown as { document?: unknown }).document;
      try {
        (globalThis as unknown as { document?: unknown }).document = {
          querySelector: (sel: string) => {
            if (sel.includes('terminal')) {
              return {
                getBoundingClientRect: () => ({
                  left: 200,
                  top: 150,
                  right: 280,
                  bottom: 230,
                  width: 80,
                  height: 80,
                }),
              };
            }
            return null;
          },
        };

        const coords = findAppTargetCoordinates('terminal');
        expect(coords).not.toBeNull();
        expect(coords?.x).toBeGreaterThan(0);
        expect(coords?.y).toBeGreaterThan(0);
      } finally {
        (globalThis as unknown as { document?: unknown }).document = originalDoc;
      }

      // Verify facing direction is updated
      useMascotStore.getState().setFacingDirection('left');
      expect(useMascotStore.getState().facingDirection).toBe('left');

      useMascotStore.getState().setFacingDirection('right');
      expect(useMascotStore.getState().facingDirection).toBe('right');
    });
  });
});

