import { useState, useEffect } from 'react';
import { useBootStore } from '../../stores/useBootStore';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { getRandomWelcomeQuote } from '../../lib/welcomeQuotes';
import './Boot.css';

interface WelcomeScreenProps {
  onComplete: () => void;
}

function parseOverlayColor(overlay: string): string {
  if (!overlay || overlay === 'none') return '#000000';
  if (overlay.startsWith('#')) return overlay;
  const match = overlay.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
  }
  return '#000000';
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const localUser = useBootStore((state) => state.localUser);
  const wallpaper = useDesktopStore((state) => state.wallpaper);
  const wallpaperPosition = useDesktopStore((state) => state.wallpaperPosition) || 'center';
  const wallpaperSize = useDesktopStore((state) => state.wallpaperSize) || 'cover';
  const wallpaperOverlay = useDesktopStore((state) => state.wallpaperOverlay) || '#000000';
  const wallpaperColor = useDesktopStore((state) => state.wallpaperColor) || '#08090d';
  const wallpaperBrightness = useDesktopStore((state) => state.wallpaperBrightness ?? 100);
  const wallpaperOverlayOpacity = useDesktopStore((state) => state.wallpaperOverlayOpacity ?? 30);

  // Random quote selected ONCE on mount and kept stable
  const [quote] = useState(() => getRandomWelcomeQuote());
  const [isExiting, setIsExiting] = useState(false);

  const hasCustomWallpaper = Boolean(wallpaper && wallpaper.trim());
  const userName = localUser?.name?.trim() || 'Guest';
  const loginDimOpacity = Math.min(1, Math.max(0.2, (wallpaperOverlayOpacity / 100) * 1.25));

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const quickTimer = setTimeout(() => {
        onComplete();
      }, 250);
      return () => clearTimeout(quickTimer);
    }

    // Begin exit transition at 1300ms
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1300);

    // Complete transition to desktop at 1500ms
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1500);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`mimios-welcome-screen ${isExiting ? 'is-exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Welcome, ${userName}`}
    >
      {/* Background Wallpaper Matching Login Screen */}
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

      {/* Dim & Vignette Overlays */}
      <div
        className="login-dim-overlay"
        style={{
          backgroundColor: parseOverlayColor(wallpaperOverlay),
          opacity: loginDimOpacity,
        }}
        aria-hidden="true"
      />
      <div className="login-vignette-overlay" aria-hidden="true" />

      {/* Centered Welcome Content Floating Over Wallpaper */}
      <div className="welcome-center-stage">
        {/* Optical Glow Lens Behind Welcome State */}
        <div className="welcome-glow-lens" aria-hidden="true" />

        {/* Minimal Circular Loading Indicator */}
        <div className="welcome-spinner-container" aria-hidden="true">
          <svg
            className="welcome-spinner-svg"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="welcome-spinner-track"
              cx="18"
              cy="18"
              r="14"
              strokeWidth="2.5"
            />
            <circle
              className="welcome-spinner-arc"
              cx="18"
              cy="18"
              r="14"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Welcome Greeting */}
        <h1 className="welcome-greeting-title">
          Welcome, <span className="welcome-user-name">{userName}</span>
        </h1>

        {/* Short Random Tip / Quote (<= 6 words) */}
        <p className="welcome-tip-quote">
          &ldquo;{quote}&rdquo;
        </p>
      </div>
    </div>
  );
}
