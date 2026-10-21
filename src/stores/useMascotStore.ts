import { create } from 'zustand';
import { useDesktopStore, gridColToX, gridRowToY } from './useDesktopStore';
import { useWindowStore } from './useWindowStore';
import { playMimiMeow } from '../lib/audio/mimiAudio';

export type MimiMood =
  | 'idle'
  | 'walking'
  | 'looking_around'
  | 'greeting'
  | 'talking'
  | 'thinking'
  | 'happy'
  | 'confused'
  | 'sleeping';

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  hint?: string;
  mood: MimiMood;
  actionLabel?: string;
  actionAppId?: string;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'desktop_launcher',
    title: 'Desktop & App Launcher',
    description: 'Welcome to MimiOS! Navigate through apps via the floating dock, launch tools from the app launcher, and manage windows with ease.',
    hint: 'Tip: You can drag icons across the desktop or click any application to launch.',
    mood: 'greeting',
    actionLabel: 'Open App Launcher',
    actionAppId: 'app_launcher',
  },
  {
    id: 'terminal_commands',
    title: 'Interactive Terminal',
    description: 'A full-fledged UNIX-like command environment with simulated utilities, command piping, file viewing, and neofetch telemetry.',
    hint: 'Try commands like help, ls, cat, and neofetch.',
    mood: 'talking',
    actionLabel: 'Open Terminal',
    actionAppId: 'terminal',
  },
  {
    id: 'file_manager',
    title: 'Virtual File System (VFS)',
    description: 'Browse directories, inspect documents, edit files in the code editor, and preview images, audio, and PDFs stored in VirtualFS.',
    hint: 'You can right-click any image in Files to set it as your wallpaper.',
    mood: 'looking_around',
    actionLabel: 'Open File Manager',
    actionAppId: 'files',
  },
  {
    id: 'portfolio_projects',
    title: 'Projects & Portfolio',
    description: 'Explore Pratyush’s software engineering work, cybersecurity projects, full-stack architectures, and developer resume.',
    hint: 'Includes live repository inspection and project case studies.',
    mood: 'happy',
    actionLabel: 'View Projects',
    actionAppId: 'projects',
  },
  {
    id: 'mimi_ai',
    title: 'MimiAI Assistant',
    description: 'Powered by NVIDIA NIM LLMs, MimiAI can answer technical questions, explain security topics, and execute operating system actions.',
    hint: 'Mimi meows whenever answering and can open applications on command!',
    mood: 'thinking',
    actionLabel: 'Chat with MimiAI',
    actionAppId: 'mimi-ai',
  },
  {
    id: 'settings_personalization',
    title: 'Personalization & Settings',
    description: 'Tune the liquid-glass aesthetic, blur radius, wallpaper backgrounds, panel docking positions, and mascot preferences.',
    hint: 'Toggle sound effects, change glass intensity, or customize desktop colors.',
    mood: 'idle',
    actionLabel: 'Open Settings',
    actionAppId: 'settings',
  },
  {
    id: 'cyber_simulations',
    title: 'Simulated Security Labs',
    description: 'Hands-on defensive tools and CTF exercises! Try commands like scan, challenge, access, and hash in Terminal to test your skills.',
    hint: 'Launch Terminal and type scan or challenge to begin.',
    mood: 'greeting',
    actionLabel: 'Launch Terminal Lab',
    actionAppId: 'terminal',
  },
];

const GUIDE_STORAGE_KEY = 'mimi_guide_completed';
const COMPANION_STORAGE_KEY = 'mimi_companion_dismissed';

export interface SpeechBubbleState {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const APP_NAMES: Record<string, string> = {
  terminal: 'Terminal',
  files: 'File Manager',
  projects: 'Projects',
  about: 'About Me',
  settings: 'Settings',
  'mimi-ai': 'MimiAI',
  ai: 'MimiAI',
  snake: 'Snake Game',
  skills: 'Skills',
  experience: 'Experience',
  certificates: 'Certificates',
  contact: 'Contact',
  editor: 'Code Editor',
  resume: 'Resume',
  'text-viewer': 'Text Viewer',
  'image-viewer': 'Image Viewer',
  'video-player': 'Video Player',
  'pdf-viewer': 'PDF Viewer',
  'admin-portal': 'Admin Portal',
  'admin-login': 'Admin Login',
};

let activeNavId = 0;

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function setStorageItem(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch {
    // ignore
  }
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function launchAppWindow(normalized: string): void {
  const existing = useWindowStore.getState().windows.find((w) => w.appId === normalized);
  if (existing) {
    if (existing.isMinimized) useWindowStore.getState().restoreWindow(existing.id);
    useWindowStore.getState().focusWindow(existing.id);
    return;
  }

  const title = APP_NAMES[normalized] || (normalized.charAt(0).toUpperCase() + normalized.slice(1));
  const width =
    normalized === 'settings'
      ? 760
      : normalized === 'snake'
        ? 440
        : normalized === 'mimi-ai' || normalized === 'ai'
          ? 840
          : 800;
  const height =
    normalized === 'settings'
      ? 520
      : normalized === 'snake'
        ? 520
        : normalized === 'mimi-ai' || normalized === 'ai'
          ? 620
          : 600;
  const params = normalized === 'resume' ? { path: '/home/pratyush/resume.pdf' } : undefined;

  useWindowStore.getState().openWindowWithParams(
    {
      id: `${normalized}-${Date.now()}`,
      appId: normalized,
      title,
      icon: normalized,
      x: 100 + Math.random() * 80,
      y: 80 + Math.random() * 60,
      width,
      height,
      isMinimized: false,
      isMaximized: false,
    },
    params
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('mimios-open-request', {
        detail: { type: 'open', appId: normalized },
      })
    );
  }
}

export function findAppTargetCoordinates(appId: string): { x: number; y: number } | null {
  if (typeof document === 'undefined') return null;
  const normalized = appId.toLowerCase().trim();

  // 1. Prefer desktop icon shortcuts
  const desktopIconEl = document.querySelector(
    `.os-desktop-minimal-column button[data-app-id="${normalized}"], .os-desktop-icons-canvas button[data-app-id="${normalized}"]`
  ) as HTMLElement | null;

  // 2. Dock pinned or taskbar buttons
  const dockBtnEl = document.querySelector(
    `.panel-pinned-group button[data-app-id="${normalized}"], .panel-button-group button[data-app-id="${normalized}"], button[data-app-id="${normalized}"]`
  ) as HTMLElement | null;

  // 3. Fallback to 9-dot App Launcher on the dock for tools that aren't directly pinned
  const launcherBtnEl = document.querySelector('button[data-app-id="app_launcher"]') as HTMLElement | null;

  const targetEl = desktopIconEl || dockBtnEl || launcherBtnEl;

  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    const targetX = Math.max(16, Math.min(winWidth - 76, Math.round(rect.left + rect.width / 2 - 28)));

    let targetY: number;
    if (rect.top > winHeight - 120) {
      // Bottom panel dock: hover comfortably above the button
      targetY = Math.max(36, Math.round(rect.top - 62));
    } else if (rect.top < 60) {
      // Top panel dock: hover below the button
      targetY = Math.min(winHeight - 76, Math.round(rect.bottom + 12));
    } else {
      // Desktop icon: align near icon
      targetY = Math.max(36, Math.min(winHeight - 76, Math.round(rect.top + rect.height / 2 - 28)));
    }

    return { x: targetX, y: targetY };
  }

  return null;
}

export interface MascotStoreState {
  mood: MimiMood;
  facingDirection: 'left' | 'right';
  isCompanionOpen: boolean;
  isGuideActive: boolean;
  guideStepIndex: number;
  hasCompletedGuide: boolean;
  isDismissed: boolean;
  companionPosition: { x: number; y: number } | null;
  moodTimeoutId: number | null;
  speechBubble: SpeechBubbleState | null;
  speechTimeoutId: number | null;
  isNavigating: boolean;

  setMood: (mood: MimiMood) => void;
  setFacingDirection: (facingDirection: 'left' | 'right') => void;
  setMoodWithTimeout: (mood: MimiMood, durationMs: number, revertMood?: MimiMood) => void;
  setCompanionOpen: (open: boolean) => void;
  toggleCompanion: () => void;
  setIsDismissed: (dismissed: boolean) => void;
  dismissMascot: () => void;
  showMascot: () => void;
  setCompanionPosition: (pos: { x: number; y: number } | null) => void;

  speak: (text: string, options?: { durationMs?: number; actionLabel?: string; onAction?: () => void }) => void;
  dismissSpeechBubble: () => void;

  navigateToApp: (appId: string, customMessage?: string) => Promise<boolean>;

  startGuide: () => void;
  closeGuide: () => void;
  nextGuideStep: () => void;
  prevGuideStep: () => void;
  skipGuide: () => void;
  finishGuide: () => void;
  resetGuide: () => void;
}

export const useMascotStore = create<MascotStoreState>((set, get) => {
  const initialGuideCompleted = getStorageItem(GUIDE_STORAGE_KEY) === 'true';

  // Clear legacy dismissed key if present so existing users are not stuck with an invisible mascot
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COMPANION_STORAGE_KEY);
    }
  } catch {
    // ignore
  }

  return {
    mood: 'idle',
    facingDirection: 'right',
    isCompanionOpen: false,
    isGuideActive: false,
    guideStepIndex: 0,
    hasCompletedGuide: initialGuideCompleted,
    isDismissed: false,
    companionPosition: null,
    moodTimeoutId: null,
    speechBubble: null,
    speechTimeoutId: null,
    isNavigating: false,

    setMood: (mood: MimiMood) => {
      // Guard against external callers canceling active walking or arrival greeting
      if (get().isNavigating && mood === 'idle') {
        return;
      }
      const { moodTimeoutId } = get();
      if (moodTimeoutId) {
        clearTimeout(moodTimeoutId);
      }
      set({ mood, moodTimeoutId: null });
    },

    setFacingDirection: (facingDirection: 'left' | 'right') => {
      set({ facingDirection });
    },

    setMoodWithTimeout: (mood: MimiMood, durationMs: number, revertMood: MimiMood = 'idle') => {
      if (get().isNavigating) {
        return;
      }
      const { moodTimeoutId } = get();
      if (moodTimeoutId) {
        clearTimeout(moodTimeoutId);
      }
      const timeoutId = Number(
        setTimeout(() => {
          set({ mood: revertMood, moodTimeoutId: null });
        }, durationMs)
      );

      set({ mood, moodTimeoutId: timeoutId });
    },

    setCompanionOpen: (isCompanionOpen: boolean) => {
      set({ isCompanionOpen });
    },

    toggleCompanion: () => {
      set(state => ({ isCompanionOpen: !state.isCompanionOpen }));
    },

    setIsDismissed: (isDismissed: boolean) => {
      if (isDismissed) {
        setStorageItem(COMPANION_STORAGE_KEY, 'true');
      } else {
        removeStorageItem(COMPANION_STORAGE_KEY);
      }
      set({ isDismissed, isCompanionOpen: isDismissed ? false : get().isCompanionOpen });
    },

    dismissMascot: () => {
      activeNavId++;
      const { speechTimeoutId, moodTimeoutId } = get();
      if (speechTimeoutId) clearTimeout(speechTimeoutId);
      if (moodTimeoutId) clearTimeout(moodTimeoutId);

      setStorageItem(COMPANION_STORAGE_KEY, 'true');
      set({
        isDismissed: true,
        isCompanionOpen: false,
        speechBubble: null,
        speechTimeoutId: null,
        moodTimeoutId: null,
        isNavigating: false,
        mood: 'idle',
      });
      useDesktopStore.getState().setMascotEnabled(false);
    },

    showMascot: () => {
      removeStorageItem(COMPANION_STORAGE_KEY);
      set({
        isDismissed: false,
        mood: 'idle',
      });
      useDesktopStore.getState().setMascotEnabled(true);
    },

    setCompanionPosition: (companionPosition) => {
      set({ companionPosition });
    },

    speak: (text: string, options?: { durationMs?: number; actionLabel?: string; onAction?: () => void }) => {
      const { speechTimeoutId } = get();
      if (speechTimeoutId) {
        clearTimeout(speechTimeoutId);
      }

      const calculatedDuration = Math.max(3500, Math.min(9000, text.length * 60));
      const duration = options?.durationMs ?? calculatedDuration;

      const bubbleId = Date.now();
      const timeoutId = Number(
        setTimeout(() => {
          const current = get().speechBubble;
          if (current && current.id === bubbleId) {
            set({ speechBubble: null, speechTimeoutId: null });
          }
        }, duration)
      );

      set({
        speechBubble: {
          id: bubbleId,
          text,
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
        },
        speechTimeoutId: timeoutId,
      });
    },

    dismissSpeechBubble: () => {
      const { speechTimeoutId } = get();
      if (speechTimeoutId) {
        clearTimeout(speechTimeoutId);
      }
      set({ speechBubble: null, speechTimeoutId: null });
    },

    navigateToApp: async (appId: string, customMessage?: string): Promise<boolean> => {
      const normalized = appId.toLowerCase().trim();
      const appName = APP_NAMES[normalized] || normalized;

      // Check if mascot is currently enabled
      if (!useDesktopStore.getState().mascotEnabled) {
        launchAppWindow(normalized);
        return true;
      }

      // Ensure mascot is visible and desktop mascot setting is enabled
      set({ isDismissed: false });
      useDesktopStore.getState().setMascotEnabled(true);

      // 1. Speak action in tiny speech bubble
      const msg = customMessage || `Opening ${appName}!`;
      get().speak(msg, { durationMs: 2500 });

      // 2. Determine target position using live DOM elements
      const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const winHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

      let targetPos = findAppTargetCoordinates(normalized);

      if (!targetPos) {
        const { icons, panelPosition } = useDesktopStore.getState();
        const icon = icons.find((i) => i.appId === normalized || i.id === normalized);

        let targetX = 80;
        let targetY = 80;

        if (icon) {
          const ix = typeof icon.x === 'number' && icon.x > 0 ? icon.x : gridColToX(icon.col ?? 0, panelPosition);
          const iy = typeof icon.y === 'number' && icon.y > 0 ? icon.y : gridRowToY(icon.row ?? 0, panelPosition);
          targetX = Math.max(16, Math.min(winWidth - 72, ix + 20));
          targetY = Math.max(36, Math.min(winHeight - 72, iy + 30));
        } else {
          if (panelPosition === 'bottom') {
            targetX = 64;
            targetY = Math.max(36, winHeight - 100);
          } else if (panelPosition === 'top') {
            targetX = 64;
            targetY = 64;
          } else if (panelPosition === 'left') {
            targetX = 64;
            targetY = 64;
          } else {
            targetX = Math.max(36, winWidth - 100);
            targetY = 64;
          }
        }
        targetPos = { x: targetX, y: targetY };
      }

      const { x: targetX, y: targetY } = targetPos;

      const navId = ++activeNavId;
      const isReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (isReducedMotion) {
        // Reduced motion: skip walk interpolation, jump immediately
        set({ companionPosition: { x: targetX, y: targetY }, mood: 'greeting', isNavigating: false });
        await new Promise((r) => setTimeout(r, 350));
        if (activeNavId !== navId) return false;

        playMimiMeow({ force: false });
        launchAppWindow(normalized);

        set({ mood: 'idle' });
        get().speak('All done! Take a look.', { durationMs: 3500 });
        return true;
      }

      // Smooth walking animation with natural travel pacing
      const containerEl =
        typeof document !== 'undefined'
          ? (document.querySelector('.mimi-companion-container') as HTMLElement | null)
          : null;

      let startPos = get().companionPosition;
      if (!startPos && containerEl) {
        const rect = containerEl.getBoundingClientRect();
        startPos = { x: Math.round(rect.left), y: Math.round(rect.top) };
      }
      if (!startPos) {
        startPos = {
          x: winWidth - 88,
          y: winHeight - 128,
        };
      }

      const dx = targetX - startPos.x;
      const dy = targetY - startPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const facingDirection: 'left' | 'right' = dx < 0 ? 'left' : 'right';

      // If already within 45px of target, tap paw in place
      if (dist <= 45) {
        set({ mood: 'greeting', facingDirection, isNavigating: true });
        await new Promise((r) => setTimeout(r, 650));
        if (activeNavId !== navId) return false;

        playMimiMeow({ force: false });
        launchAppWindow(normalized);

        await new Promise((r) => setTimeout(r, 200));
        if (activeNavId !== navId) return false;

        set({ mood: 'idle', isNavigating: false });
        get().speak('All done! Take a look.', { durationMs: 3500 });
        return true;
      }

      // Animate walking across the desktop over 800ms - 1600ms
      const duration = Math.max(800, Math.min(1600, dist * 1.5));
      set({ mood: 'walking', facingDirection, isNavigating: true });

      await new Promise<void>((resolve) => {
        if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
          set({ companionPosition: { x: targetX, y: targetY } });
          resolve();
          return;
        }

        const startTime = performance.now();
        function animate(currentTime: number) {
          if (activeNavId !== navId) {
            resolve();
            return;
          }
          const elapsed = currentTime - startTime;
          const progress = Math.min(1, elapsed / duration);
          const ease = 1 - Math.pow(1 - progress, 3);
          const curX = Math.round(startPos!.x + dx * ease);
          const curY = Math.round(startPos!.y + dy * ease);

          set({ companionPosition: { x: curX, y: curY } });
          if (containerEl) {
            containerEl.style.left = `${curX}px`;
            containerEl.style.top = `${curY}px`;
          }

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            set({ companionPosition: { x: targetX, y: targetY } });
            if (containerEl) {
              containerEl.style.left = `${targetX}px`;
              containerEl.style.top = `${targetY}px`;
            }
            resolve();
          }
        }
        requestAnimationFrame(animate);
      });

      if (activeNavId !== navId) return false;

      // Paw tap / greeting wave on reaching the app icon
      set({ mood: 'greeting' });
      await new Promise((r) => setTimeout(r, 650));
      if (activeNavId !== navId) return false;

      playMimiMeow({ force: false });
      launchAppWindow(normalized);

      await new Promise((r) => setTimeout(r, 250));
      if (activeNavId !== navId) return false;

      set({ mood: 'idle', isNavigating: false });
      get().speak('All done! Take a look.', { durationMs: 3500 });
      return true;
    },

    startGuide: () => {
      const firstStepMood = GUIDE_STEPS[0]?.mood || 'greeting';
      set({
        isGuideActive: true,
        guideStepIndex: 0,
        isCompanionOpen: true,
        isDismissed: false,
        mood: firstStepMood,
      });
    },

    closeGuide: () => {
      set({
        isGuideActive: false,
        isCompanionOpen: false,
        mood: 'idle',
      });
    },

    nextGuideStep: () => {
      const { guideStepIndex } = get();
      if (guideStepIndex < GUIDE_STEPS.length - 1) {
        const nextIndex = guideStepIndex + 1;
        const nextMood = GUIDE_STEPS[nextIndex]?.mood || 'idle';
        set({
          guideStepIndex: nextIndex,
          mood: nextMood,
        });
      } else {
        get().finishGuide();
      }
    },

    prevGuideStep: () => {
      const { guideStepIndex } = get();
      if (guideStepIndex > 0) {
        const prevIndex = guideStepIndex - 1;
        const prevMood = GUIDE_STEPS[prevIndex]?.mood || 'idle';
        set({
          guideStepIndex: prevIndex,
          mood: prevMood,
        });
      }
    },

    skipGuide: () => {
      setStorageItem(GUIDE_STORAGE_KEY, 'true');
      set({
        isGuideActive: false,
        isCompanionOpen: false,
        hasCompletedGuide: true,
        mood: 'idle',
      });
    },

    finishGuide: () => {
      setStorageItem(GUIDE_STORAGE_KEY, 'true');
      set({
        isGuideActive: false,
        isCompanionOpen: false,
        hasCompletedGuide: true,
      });
      get().setMoodWithTimeout('happy', 3500, 'idle');
    },

    resetGuide: () => {
      removeStorageItem(GUIDE_STORAGE_KEY);
      set({
        hasCompletedGuide: false,
      });
      get().startGuide();
    },
  };
});

if (typeof window !== 'undefined') {
  (window as unknown as { useMascotStore?: typeof useMascotStore }).useMascotStore = useMascotStore;
}

