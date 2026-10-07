import { useCallback, useEffect, useRef } from 'react';
import { playBootChime } from '../../lib/audio/bootSound';
import './Boot.css';

interface PowerOffScreenProps {
  onPowerOn: () => void;
}

export function PowerOffScreen({ onPowerOn }: PowerOffScreenProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const handlePowerClick = useCallback(() => {
    playBootChime();
    onPowerOn();
  }, [onPowerOn]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePowerClick();
      }
    },
    [handlePowerClick]
  );

  return (
    <div
      className="poweroff-screen"
      role="region"
      aria-label="MimiOS Machine Powered Off"
    >
      <button
        ref={buttonRef}
        type="button"
        className="power-button"
        onClick={handlePowerClick}
        onKeyDown={handleKeyDown}
        aria-label="Power on MimiOS machine"
        title="Power on MimiOS"
      >
        <span className="power-button-bezel">
          <span className="power-button-face">
            <svg
              className="power-button-icon"
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v10" />
              <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
            </svg>
            <span className="power-button-led" aria-hidden="true" />
          </span>
        </span>
      </button>
    </div>
  );
}
