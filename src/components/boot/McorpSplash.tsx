import { useEffect } from 'react';
import './Boot.css';

interface McorpSplashProps {
  onComplete: () => void;
}

export function McorpSplash({ onComplete }: McorpSplashProps) {
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const duration = prefersReducedMotion ? 400 : 1300;

    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'F2' || e.key === 'F12') {
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
      className="mcorp-splash"
      role="status"
      aria-live="polite"
      aria-label="Mcorp hardware initialization"
    >
      <header className="mcorp-firmware-bar" aria-hidden="true">
        <span>MCORP FIRMWARE v3.2.0 (ACPI 6.4)</span>
        <span>MEM: 32768 MB OK</span>
      </header>

      <main className="mcorp-center">
        <div className="mcorp-logo-wrapper">
          <img
            src="/assets/branding/mcorp-logo.svg"
            alt="Mcorp Computing Systems"
            className="mcorp-logo-image"
            onError={(e) => {
              // Graceful inline fallback if asset missing
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.mcorp-fallback-logo');
              if (fallback) (fallback as HTMLElement).style.display = 'block';
            }}
          />
          <div className="mcorp-fallback-logo" style={{ display: 'none' }}>
            <span className="mcorp-fallback-title">MCORP</span>
            <span className="mcorp-fallback-subtitle">COMPUTING SYSTEMS</span>
          </div>
        </div>
        <div className="mcorp-firmware-spinner" aria-hidden="true" />
      </main>

      <footer className="mcorp-prompt-bar" aria-hidden="true">
        <span>Press <strong>[F2]</strong> for Setup</span>
        <span>•</span>
        <span>Press <strong>[F12]</strong> for Boot Menu</span>
      </footer>
    </div>
  );
}
