import { useEffect } from 'react';
import './Boot.css';

interface MimiOSSplashProps {
  onComplete: () => void;
}

export function MimiOSSplash({ onComplete }: MimiOSSplashProps) {
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const duration = prefersReducedMotion ? 400 : 1400;

    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(timer);
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onComplete]);

  return (
    <div
      className="mimios-splash"
      role="status"
      aria-live="polite"
      aria-label="MimiOS System Loading"
    >
      <div className="mimios-splash-card">
        {/* Centered MimiOS Branding */}
        <div className="mimios-logo-container">
          <img
            src="/assets/branding/mimios-logo.svg"
            alt="MimiOS"
            className="mimios-splash-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.mimios-splash-fallback');
              if (fallback) (fallback as HTMLElement).style.display = 'flex';
            }}
          />
          <div className="mimios-splash-fallback" style={{ display: 'none' }}>
            <span className="mimios-fallback-emblem">🐱</span>
          </div>
        </div>

        <div className="mimios-splash-text">
          <h1 className="mimios-splash-title">MimiOS</h1>
          <p className="mimios-splash-subtitle">Web Operating System</p>
        </div>

        {/* Personality Feature: Running Cat Loading Track */}
        <div className="mimios-cat-track-container" aria-label="Loading system environment">
          <div className="mimios-cat-track-line" />
          <div className="mimios-cat-runner">
            <img
              src="/assets/branding/mimios-boot-cat.svg"
              alt="Mimi"
              className="mimios-boot-cat-img"
              onError={(e) => {
                // Fallback to inline SVG cat runner if file is missing
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.parentElement?.querySelector('.mimios-cat-fallback');
                if (fb) (fb as HTMLElement).style.display = 'block';
              }}
            />
            <svg
              className="mimios-cat-fallback"
              style={{ display: 'none' }}
              viewBox="0 0 32 20"
              width="32"
              height="20"
              fill="#f8fafc"
            >
              <path d="M4 12 C2 14 6 18 10 16 C14 14 20 14 24 16 L28 12 L24 8 L22 10 C18 10 14 10 10 12 Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
