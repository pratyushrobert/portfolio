import { useState, useEffect, useRef } from 'react';
import { vfs } from '../../lib/vfs';
import { configApi } from '../../lib/api/config';
import { checkAdminSession } from '../../lib/auth/adminAuth';
import { useDesktopStore } from '../../stores/useDesktopStore';
import './Boot.css';

interface BootStep {
  id: string;
  tag: 'OK' | 'INFO';
  message: string;
}

const SYSTEM_BOOT_STEPS: BootStep[] = [
  { id: 'arch', tag: 'OK', message: 'Initializing MCORP x86_64 architecture' },
  { id: 'kernel', tag: 'OK', message: 'Loading MimiOS microkernel v2026.10' },
  { id: 'mem', tag: 'OK', message: 'Initializing memory manager & page tables' },
  { id: 'sched', tag: 'OK', message: 'Initializing process scheduler' },
  { id: 'crypto', tag: 'OK', message: 'Loading cryptography & hashing subsystem' },
  { id: 'sec', tag: 'OK', message: 'Initializing secure sandboxed runtime' },
  { id: 'vfs', tag: 'OK', message: 'Mounting POSIX Virtual File System (VirtualFS)' },
  { id: 'userfs', tag: 'OK', message: 'Mounting user filesystem at /home/pratyush' },
  { id: 'fsck', tag: 'OK', message: 'Checking filesystem integrity: 100% clean' },
  { id: 'config', tag: 'OK', message: 'Connecting system services & configuration API' },
  { id: 'daemon', tag: 'OK', message: 'Starting system daemon services' },
  { id: 'display', tag: 'OK', message: 'Initializing display compositor & glass renderer' },
  { id: 'net', tag: 'OK', message: 'Initializing network stack & WebSockets' },
  { id: 'desktop', tag: 'OK', message: 'Loading desktop environment & session manager' },
  { id: 'wm', tag: 'OK', message: 'Initializing window manager & compositor' },
  { id: 'shell', tag: 'OK', message: 'Starting MimiOS interactive shell' },
  { id: 'session', tag: 'OK', message: 'Loading local user session environment' },
  { id: 'ready', tag: 'OK', message: 'MimiOS system initialization complete' },
];

interface SystemBootSequenceProps {
  onComplete: () => void;
  onError: (error: string) => void;
}

export function SystemBootSequence({ onComplete, onError }: SystemBootSequenceProps) {
  const [completedSteps, setCompletedSteps] = useState<BootStep[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as each new line arrives
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [completedSteps]);

  useEffect(() => {
    mountedRef.current = true;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ~120ms per line -> 18 lines take ~2.16s + 0.28s ready pause = ~2.5s total
    const stepDelay = prefersReducedMotion ? 25 : 120;
    let currentStepIndex = 0;

    // Concurrent background preloading
    const initPromise = (async () => {
      try {
        // 1. Verify VFS state
        vfs.getState();

        // 2. Preload authoritative backend config & wallpaper
        const config = await configApi.get().catch(() => null);
        if (config && mountedRef.current) {
          const rawBrightness = config.wallpaper_brightness ? parseInt(config.wallpaper_brightness, 10) : 100;
          const rawOverlayOpacity = config.wallpaper_overlay_opacity ? parseInt(config.wallpaper_overlay_opacity, 10) : 30;
          const activeBrightness = isNaN(rawBrightness) ? 100 : Math.min(100, Math.max(0, rawBrightness));
          const activeOverlayOpacity = isNaN(rawOverlayOpacity) ? 30 : Math.min(100, Math.max(0, rawOverlayOpacity));

          useDesktopStore.getState().setBackgroundConfig({
            wallpaper: config.wallpaper_url ?? '',
            wallpaperPosition: config.wallpaper_position ?? 'center',
            wallpaperSize: config.wallpaper_size ?? 'cover',
            wallpaperOverlay: config.wallpaper_overlay ?? '#000000',
            wallpaperColor: config.wallpaper_color && config.wallpaper_color !== '#1a1a2e' ? config.wallpaper_color : '#08090d',
            wallpaperBrightness: activeBrightness,
            wallpaperOverlayOpacity: activeOverlayOpacity,
          });
        }

        // 3. Check admin auth session
        await checkAdminSession().catch(() => null);
      } catch (err) {
        console.warn('System initialization notice:', err);
      }
    })();

    const advanceStep = () => {
      if (!mountedRef.current) return;

      if (currentStepIndex < SYSTEM_BOOT_STEPS.length) {
        const nextStep = SYSTEM_BOOT_STEPS[currentStepIndex];
        setCompletedSteps((prev) => [...prev, nextStep]);
        currentStepIndex++;
        timerRef.current = setTimeout(advanceStep, stepDelay);
      } else {
        initPromise
          .then(() => {
            if (!mountedRef.current) return;
            setIsInitializing(false);
            timerRef.current = setTimeout(() => {
              if (mountedRef.current) {
                onComplete();
              }
            }, prefersReducedMotion ? 60 : 280);
          })
          .catch((err: unknown) => {
            if (mountedRef.current) {
              onError(err instanceof Error ? err.message : 'System initialization failed');
            }
          });
      }
    };

    // Begin visual progression
    timerRef.current = setTimeout(advanceStep, prefersReducedMotion ? 20 : 60);

    // Keyboard shortcut to skip
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete, onError]);

  const progressPercent = Math.min(
    100,
    Math.round((completedSteps.length / SYSTEM_BOOT_STEPS.length) * 100)
  );

  return (
    <div
      className="boot-screen"
      role="status"
      aria-live="polite"
      aria-label="MimiOS System Initialization"
    >
      <header className="boot-header">
        <div className="boot-brand">
          <div className="boot-mono-indicator">[MCORP-FIRMWARE]</div>
          <div>
            <div className="boot-title">MimiOS Kernel Bootloader</div>
            <div className="boot-subtitle">v2026.10 • x86_64 Web Platform</div>
          </div>
        </div>
        <button
          type="button"
          className="boot-skip-btn"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            onComplete();
          }}
          aria-label="Skip boot sequence"
        >
          Skip <span>[Space]</span>
        </button>
      </header>

      <main className="boot-log-container" ref={logContainerRef}>
        {completedSteps.map((step) => (
          <div key={step.id} className="boot-line">
            <span className={`boot-tag ${step.tag.toLowerCase()}`}>
              [ &nbsp;{step.tag}&nbsp; ]
            </span>
            <span className="boot-msg">{step.message}</span>
          </div>
        ))}
        {isInitializing && (
          <div className="boot-line" style={{ animation: 'none', opacity: 1 }}>
            <span className="boot-cursor" aria-hidden="true" />
          </div>
        )}
        <div ref={logEndRef} style={{ height: 1 }} />
      </main>

      <footer className="boot-footer">
        <span className="boot-status-text">
          {progressPercent < 100
            ? `Booting Subsystems (${progressPercent}%)...`
            : 'All Subsystems Operational. Starting MimiOS...'}
        </span>
        <div className="boot-progress-track">
          <div
            className="boot-progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </footer>
    </div>
  );
}
