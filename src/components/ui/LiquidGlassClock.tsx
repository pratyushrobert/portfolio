import { useState, useEffect } from 'react';
import './LiquidGlassClock.css';

interface LiquidGlassClockProps {
  className?: string;
  showDate?: boolean;
}

export function LiquidGlassClock({ className = '', showDate = true }: LiquidGlassClockProps) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    // Update live 24-hour clock smoothly every second
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;

  const formattedDate = time.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={`liquid-glass-clock ${className}`}
      aria-label={`Current time: ${timeString}${showDate ? `, ${formattedDate}` : ''}`}
    >
      {/* Subtle Ambient Optical Diffusion Behind Digits (Borderless) */}
      <div className="liquid-clock-glow-diffusion" aria-hidden="true" />

      {/* Optical Wallpaper Refraction Lens Behind Digits */}
      <div className="liquid-clock-time-lens" aria-hidden="true" />

      {/* Primary Liquid-Glass Digits */}
      <div
        className="liquid-clock-time-val"
        data-time={timeString}
        role="timer"
      >
        <span className="liquid-clock-time-digits">{timeString}</span>
      </div>

      {/* Secondary Subdued Date */}
      {showDate && <div className="liquid-clock-date">{formattedDate}</div>}
    </div>
  );
}
