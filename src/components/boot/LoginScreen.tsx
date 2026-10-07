import { useState, useEffect, useRef } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ArrowRight, Power, Wifi, Bluetooth, Battery, BatteryCharging } from 'lucide-react';
import { useBootStore } from '../../stores/useBootStore';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { configApi } from '../../lib/api/config';
import { LiquidGlassClock } from '../ui/LiquidGlassClock';
import './Boot.css';

function parseOverlayColor(overlay: string): string {
  if (!overlay || overlay === 'none') return '#000000';
  if (overlay.startsWith('#')) return overlay;
  const match = overlay.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
  }
  return '#000000';
}

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

interface BatteryState {
  level: number | null;
  charging: boolean;
  supported: boolean;
}

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onPowerOff: () => void;
}

export function LoginScreen({ onLoginSuccess, onPowerOff }: LoginScreenProps) {
  const { setLocalUser, localUser } = useBootStore();
  const wallpaper = useDesktopStore((state) => state.wallpaper);
  const wallpaperPosition = useDesktopStore((state) => state.wallpaperPosition) || 'center';
  const wallpaperSize = useDesktopStore((state) => state.wallpaperSize) || 'cover';
  const wallpaperOverlay = useDesktopStore((state) => state.wallpaperOverlay) || '#000000';
  const wallpaperColor = useDesktopStore((state) => state.wallpaperColor) || '#08090d';
  const wallpaperBrightness = useDesktopStore((state) => state.wallpaperBrightness ?? 100);
  const wallpaperOverlayOpacity = useDesktopStore((state) => state.wallpaperOverlayOpacity ?? 30);
  const setBackgroundConfig = useDesktopStore((state) => state.setBackgroundConfig);

  const [name, setName] = useState(
    localUser?.name && localUser.name !== 'Guest' ? localUser.name : ''
  );
  const [isSettled, setIsSettled] = useState(() => {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  });
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [batteryState, setBatteryState] = useState<BatteryState>({
    level: null,
    charging: false,
    supported: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync wallpaper with authoritative backend site_config on mount
  useEffect(() => {
    let active = true;
    async function syncConfig() {
      try {
        const config = await configApi.get();
        if (!active || !config) return;
        const rawBrightness = config.wallpaper_brightness ? parseInt(config.wallpaper_brightness, 10) : 100;
        const rawOverlayOpacity = config.wallpaper_overlay_opacity ? parseInt(config.wallpaper_overlay_opacity, 10) : 30;
        const activeBrightness = isNaN(rawBrightness) ? 100 : Math.min(100, Math.max(0, rawBrightness));
        const activeOverlayOpacity = isNaN(rawOverlayOpacity) ? 30 : Math.min(100, Math.max(0, rawOverlayOpacity));

        setBackgroundConfig({
          wallpaper: config.wallpaper_url ?? '',
          wallpaperPosition: config.wallpaper_position ?? 'center',
          wallpaperSize: config.wallpaper_size ?? 'cover',
          wallpaperOverlay: config.wallpaper_overlay ?? '#000000',
          wallpaperColor: config.wallpaper_color && config.wallpaper_color !== '#1a1a2e' ? config.wallpaper_color : '#08090d',
          wallpaperBrightness: activeBrightness,
          wallpaperOverlayOpacity: activeOverlayOpacity,
        });
      } catch {
        // Fall back gracefully to persisted store
      }
    }
    void syncConfig();
    return () => {
      active = false;
    };
  }, [setBackgroundConfig]);

  // Track network connectivity changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Safely query Battery Status API if supported
  useEffect(() => {
    let active = true;
    let batteryManager: BatteryManagerLike | null = null;

    const updateBattery = () => {
      if (!active || !batteryManager) return;
      setBatteryState({
        level: Math.round(batteryManager.level * 100),
        charging: batteryManager.charging,
        supported: true,
      });
    };

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithBattery) : undefined;
    if (typeof nav?.getBattery === 'function') {
      nav
        .getBattery()
        .then((bm) => {
          if (!active) return;
          batteryManager = bm;
          updateBattery();
          bm.addEventListener('levelchange', updateBattery);
          bm.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => {
          // Gracefully fall back to neutral state without percentages
        });
    }

    return () => {
      active = false;
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBattery);
        batteryManager.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  // Autofocus the name field once glass expansion finishes settling
  useEffect(() => {
    if (isSettled) {
      inputRef.current?.focus();
      return;
    }

    const timer = setTimeout(() => {
      setIsSettled(true);
      inputRef.current?.focus();
    }, 1050);

    return () => clearTimeout(timer);
  }, [isSettled]);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    const finalName = name.trim() || 'Guest';
    setLocalUser(finalName);
    setIsSubmitting(true);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onLoginSuccess();
    } else {
      setTimeout(() => {
        onLoginSuccess();
      }, 100);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const batteryTooltip =
    batteryState.supported && batteryState.level !== null
      ? `Battery: ${batteryState.level}%${batteryState.charging ? ' (Charging)' : ''}`
      : 'Battery: Ready';

  const initialLetter = name.trim().charAt(0).toUpperCase();
  const hasCustomWallpaper = Boolean(wallpaper && wallpaper.trim());

  // Derive login screen dimming opacity from centralized admin config
  const loginDimOpacity = Math.min(1, Math.max(0.2, (wallpaperOverlayOpacity / 100) * 1.25));

  return (
    <div
      className={`login-screen ${isSubmitting ? 'is-submitting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="MimiOS System Login"
    >
      {/* Layer 1: Authoritative Desktop Wallpaper with Admin Brightness */}
      <div
        className={`login-wallpaper ${!hasCustomWallpaper ? 'has-fallback' : ''}`}
        style={{
          backgroundColor: wallpaperColor,
          backgroundImage: hasCustomWallpaper ? `url("${wallpaper}")` : undefined,
          backgroundSize: wallpaperSize,
          backgroundPosition: wallpaperPosition,
          filter: `brightness(${wallpaperBrightness}%)`,
        }}
        aria-hidden="true"
      />

      {/* Layer 2: Dark Translucent Overlay Derived from Admin Config */}
      <div
        className="login-dim-overlay"
        style={{
          backgroundColor: parseOverlayColor(wallpaperOverlay),
          opacity: loginDimOpacity,
        }}
        aria-hidden="true"
      />

      {/* Layer 3: Subtle Vignette Framing */}
      <div className="login-vignette-overlay" aria-hidden="true" />

      {/* Top System Header: Liquid-Glass System Status Indicators */}
      <header className="login-header">
        <div className="login-status-group" role="status" aria-label="System status">
          <div
            className="login-status-item"
            title={isOnline ? 'Wi-Fi: Connected' : 'Wi-Fi: Disconnected'}
            aria-label={isOnline ? 'Wi-Fi connected' : 'Wi-Fi disconnected'}
          >
            <Wifi size={13} className={`login-status-icon ${!isOnline ? 'is-offline' : ''}`} />
          </div>

          <span className="login-status-divider" aria-hidden="true" />

          <div
            className="login-status-item"
            title="Bluetooth: Ready"
            aria-label="Bluetooth ready"
          >
            <Bluetooth size={13} className="login-status-icon" />
          </div>

          <span className="login-status-divider" aria-hidden="true" />

          <div
            className="login-status-item login-status-battery"
            title={batteryTooltip}
            aria-label={batteryTooltip}
          >
            {batteryState.charging ? (
              <BatteryCharging size={14} className="login-status-icon" />
            ) : (
              <Battery size={14} className="login-status-icon" />
            )}
            {batteryState.level !== null && (
              <span className="login-status-battery-text">{batteryState.level}%</span>
            )}
          </div>
        </div>
      </header>

      {/* Center Stage: Large Liquid-Glass Time Display + Identity Card */}
      <main className="login-stage">
        {/* Large Central Liquid-Glass Time Display (Shared Reusable Component) */}
        <LiquidGlassClock className="login-glass-clock-container" />

        {/* Floating Liquid-Glass Identity Card */}
        <div className={`login-glass-card ${isSettled ? 'settled' : 'expanding'}`}>
          {/* Specular edge reflection and perimeter highlight */}
          <div className="login-glass-edge-reflection" aria-hidden="true" />

          {/* Internal caustics and liquid light diffusion */}
          <div className="login-glass-internal-light" aria-hidden="true" />

          {/* MimiOS Brand Header - Stagger 1 */}
          <div className="login-branding login-stagger-1">
            <img
              src="/assets/branding/mimios-logo.svg"
              alt="MimiOS"
              className="login-brand-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="login-brand-title">MimiOS</span>
          </div>

          {/* User Avatar: The Permanent Origin Anchor */}
          <div className="login-avatar-container">
            {initialLetter ? (
              <span className="login-avatar-initial">{initialLetter}</span>
            ) : (
              <>
                <img
                  src="/assets/branding/user-avatar.svg"
                  alt="User Avatar"
                  className="login-avatar-image"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector(
                      '.login-avatar-fallback'
                    );
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
                <div className="login-avatar-fallback" style={{ display: 'none' }}>
                  <span>●</span>
                </div>
              </>
            )}
          </div>

          {/* Question Prompt - Stagger 2 */}
          <div className="login-prompt-header login-stagger-2">
            <h1 className="login-prompt-title">What's your name?</h1>
            <p className="login-prompt-subtitle">Enter your name to begin</p>
          </div>

          {/* Name Input & Continue Form - Stagger 3 */}
          <form className="login-form login-stagger-3" onSubmit={handleSubmit}>
            <div className="login-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="login-name-input"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                aria-label="Your name"
              />
            </div>

            <button
              type="submit"
              className="login-continue-btn"
              aria-label="Continue to MimiOS Desktop"
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Footer - Stagger 4 */}
          <footer className="login-card-footer login-stagger-4">
            <span>MCORP Web Architecture • v2026.10</span>
          </footer>
        </div>
      </main>

      {/* Bottom System Footer: Centered Enter Hint & Bottom-Right Shut Down Button */}
      <footer className="login-footer">
        <div className="login-bottom-hint">
          <span className="login-bottom-hint-pill">
            Press <strong>Enter ↵</strong> to continue
          </span>
        </div>

        <button
          type="button"
          className="login-power-btn"
          onClick={onPowerOff}
          title="Shut Down Machine"
          aria-label="Shut down machine"
        >
          <Power size={13} />
          <span>Shut Down</span>
        </button>
      </footer>
    </div>
  );
}
