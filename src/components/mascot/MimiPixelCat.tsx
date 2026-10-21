import React from 'react';
import type { MimiMood } from '../../stores/useMascotStore';
import './MimiPixelCat.css';

export interface MimiPixelCatProps {
  mood?: MimiMood;
  size?: number;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * MimiPixelCat — Black-and-white pixel art mascot for MimiOS.
 * Scalable crisp vector SVG with zero external dependencies and zero antialiased blur.
 */
export const MimiPixelCat: React.FC<MimiPixelCatProps> = ({
  mood = 'idle',
  size = 48,
  className = '',
  onClick,
  ariaLabel = `Mimi the Cat (${mood})`,
}) => {
  const isSleeping = mood === 'sleeping';
  const isGreeting = mood === 'greeting';
  const isWalking = mood === 'walking';
  const isLookingAround = mood === 'looking_around';
  const isThinking = mood === 'thinking';
  const isHappy = mood === 'happy';
  const isConfused = mood === 'confused';
  const isTalking = mood === 'talking';

  return (
    <div
      className={`mimi-pixel-cat-root mimi-mood-${mood} ${className}`}
      onClick={onClick}
      role="img"
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
    >
      <svg
        className="mimi-pixel-cat-svg"
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
      >
        <defs>
          <filter id="mimi-pixel-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ================= SLEEPING VARIANT ================= */}
        {isSleeping ? (
          <g className="cat-body-sleeping">
            {/* Curled Body (Black Fur) */}
            <rect x="7" y="16" width="18" height="11" fill="#12151d" />
            <rect x="6" y="18" width="20" height="8" fill="#12151d" />
            <rect x="8" y="15" width="16" height="13" fill="#1f2430" />

            {/* White Belly & Paws tucked in */}
            <rect x="11" y="21" width="9" height="5" fill="#f8fafc" />
            <rect x="20" y="22" width="4" height="4" fill="#cbd5e1" />
            <rect x="8" y="22" width="3" height="4" fill="#f8fafc" />

            {/* Curled Tail wrapping around */}
            <path
              d="M25 21H27V25H24V26H20V25H24V22H25V21Z"
              fill="#12151d"
            />

            {/* Sleeping Head */}
            <rect x="6" y="16" width="10" height="9" fill="#12151d" />
            <rect x="7" y="17" width="8" height="7" fill="#1f2430" />

            {/* Ears (flat/relaxed) */}
            <polygon points="6,16 6,13 9,16" fill="#12151d" />
            <polygon points="7,16 7,14 9,16" fill="#f472b6" />
            <polygon points="12,16 15,13 15,16" fill="#12151d" />
            <polygon points="13,16 14,14 14,16" fill="#f472b6" />

            {/* White Muzzle */}
            <rect x="6" y="20" width="5" height="4" fill="#f8fafc" />
            {/* Pink Nose */}
            <rect x="7" y="21" width="1" height="1" fill="#f472b6" />

            {/* Peaceful Sleeping Eyes (Dashes) */}
            <rect x="9" y="19" width="3" height="1" fill="#090b0e" />

            {/* Floating Pixel Zzz */}
            <g className="sleep-zzz">
              <path d="M21 7H25L22 10H25V11H21V10L24 8H21V7Z" fill="#94a3b8" />
              <path d="M25 3H28L26 5H28V6H25V5L27 4H25V3Z" fill="#cbd5e1" />
            </g>
          </g>
        ) : (
          /* ================= ACTIVE / UPRIGHT VARIANT ================= */
          <g>
            {/* TAIL (Sways with mood) */}
            <g className="cat-tail">
              <path
                d="M23 23H25V21H26V17H27V13H26V12H24V14H25V17H24V21H23V23Z"
                fill="#12151d"
              />
              {/* White Tail Tip */}
              <rect x="24" y="12" width="2" height="2" fill="#f8fafc" />
            </g>

            {/* BODY (Black Fur base with charcoal depth) */}
            <g className="cat-body">
              <rect x="9" y="17" width="14" height="10" fill="#12151d" />
              <rect x="8" y="19" width="16" height="7" fill="#12151d" />
              <rect x="10" y="18" width="12" height="8" fill="#1f2430" />

              {/* White Chest / Bib */}
              <path
                d="M13 18H19V21H18V24H14V21H13V18Z"
                fill="#f8fafc"
              />
              <rect x="14" y="21" width="4" height="3" fill="#e2e8f0" />

              {/* PAWS */}
              {/* Left Paw */}
              <g className={`paw-left ${isWalking ? 'paw-walking-left' : ''}`}>
                <rect x="10" y="25" width="4" height="3" fill="#f8fafc" />
                <rect x="11" y="27" width="1" height="1" fill="#090b0e" />
                <rect x="13" y="27" width="1" height="1" fill="#090b0e" />
              </g>

              {/* Right Paw (Normal or Raised Waving) */}
              {isGreeting ? (
                <g className="paw-wave">
                  <path
                    d="M19 19H22V16H24V14H22V15H20V17H19V19Z"
                    fill="#12151d"
                  />
                  <rect x="22" y="13" width="3" height="3" fill="#f8fafc" />
                  <rect x="23" y="14" width="1" height="1" fill="#f472b6" />
                </g>
              ) : (
                <g className={`paw-right ${isWalking ? 'paw-walking-right' : ''}`}>
                  <rect x="18" y="25" width="4" height="3" fill="#f8fafc" />
                  <rect x="19" y="27" width="1" height="1" fill="#090b0e" />
                  <rect x="21" y="27" width="1" height="1" fill="#090b0e" />
                </g>
              )}
            </g>

            {/* HEAD (Includes ears, face, whiskers) */}
            <g className="cat-head">
              {/* Left Ear */}
              <g className="ear-left">
                <polygon points="8,12 8,5 12,5 12,12" fill="#12151d" />
                <polygon points="8,5 11,5 11,9 9,11" fill="#1f2430" />
                {/* Pink Inner Ear */}
                <rect x="9" y="6" width="2" height="4" fill="#f472b6" />
              </g>

              {/* Right Ear */}
              <g className="ear-right">
                <polygon points="20,12 20,5 24,5 24,12" fill="#12151d" />
                <polygon points="21,5 24,5 23,11 21,9" fill="#1f2430" />
                {/* Pink Inner Ear */}
                <rect x="21" y="6" width="2" height="4" fill="#f472b6" />
              </g>

              {/* Head Base (Black Fur) */}
              <rect x="7" y="10" width="18" height="9" fill="#12151d" />
              <rect x="8" y="9" width="16" height="11" fill="#12151d" />
              <rect x="9" y="10" width="14" height="9" fill="#1f2430" />

              {/* White Muzzle */}
              <rect x="12" y="14" width="8" height="5" fill="#f8fafc" />
              <rect x="11" y="15" width="10" height="3" fill="#f8fafc" />
              <rect x="13" y="17" width="6" height="2" fill="#e2e8f0" />

              {/* Cute Pink Nose */}
              <rect x="15" y="14" width="2" height="1" fill="#f472b6" />

              {/* Whiskers (Crisp subtle pixel lines) */}
              <rect x="4" y="15" width="5" height="1" fill="#cbd5e1" opacity="0.8" />
              <rect x="5" y="17" width="4" height="1" fill="#cbd5e1" opacity="0.8" />
              <rect x="23" y="15" width="5" height="1" fill="#cbd5e1" opacity="0.8" />
              <rect x="23" y="17" width="4" height="1" fill="#cbd5e1" opacity="0.8" />

              {/* ================= EYES & MOUTH BY MOOD ================= */}
              {isHappy ? (
                /* Happy closed curved smiling eyes (^ ^) */
                <g>
                  <path d="M10 13L11 12L12 13" stroke="#090b0e" strokeWidth="1" fill="none" />
                  <path d="M20 13L21 12L22 13" stroke="#090b0e" strokeWidth="1" fill="none" />
                  {/* Subtle blush */}
                  <rect x="9" y="15" width="2" height="1" fill="#fda4af" opacity="0.7" />
                  <rect x="21" y="15" width="2" height="1" fill="#fda4af" opacity="0.7" />
                </g>
              ) : isThinking ? (
                /* Thinking: Eyes directed upward */
                <g>
                  <rect x="11" y="11" width="2" height="2" fill="#090b0e" />
                  <rect x="12" y="11" width="1" height="1" fill="#ffffff" />
                  <rect x="19" y="11" width="2" height="2" fill="#090b0e" />
                  <rect x="20" y="11" width="1" height="1" fill="#ffffff" />
                </g>
              ) : isConfused ? (
                /* Confused: One eye wide, one squinted */
                <g>
                  {/* Left Eye Wide */}
                  <rect x="10" y="12" width="3" height="3" fill="#090b0e" />
                  <rect x="11" y="12" width="1" height="1" fill="#ffffff" />
                  {/* Right Eye Squinted */}
                  <rect x="19" y="13" width="3" height="1" fill="#090b0e" />
                </g>
              ) : isLookingAround ? (
                /* Looking around: Gaze shifted to side */
                <g>
                  <rect x="9" y="12" width="2" height="2" fill="#090b0e" />
                  <rect x="9" y="12" width="1" height="1" fill="#ffffff" />
                  <rect x="17" y="12" width="2" height="2" fill="#090b0e" />
                  <rect x="17" y="12" width="1" height="1" fill="#ffffff" />
                </g>
              ) : (
                /* Normal alert eyes with natural blink animation */
                <g className="cat-eye-pupil">
                  <rect x="11" y="12" width="2" height="2" fill="#090b0e" />
                  <rect x="11" y="12" width="1" height="1" fill="#ffffff" />
                  <rect x="19" y="12" width="2" height="2" fill="#090b0e" />
                  <rect x="19" y="12" width="1" height="1" fill="#ffffff" />
                </g>
              )}

              {/* Mouth */}
              {isTalking ? (
                /* Talking: animated mouth opening */
                <g className="cat-mouth-open">
                  <rect x="15" y="16" width="2" height="2" fill="#090b0e" />
                  <rect x="15" y="17" width="2" height="1" fill="#fb7185" />
                </g>
              ) : (
                /* Resting cat smile */
                <path
                  d="M14 16H15V17H17V16H18"
                  stroke="#64748b"
                  strokeWidth="0.8"
                  fill="none"
                />
              )}
            </g>

            {/* ================= FLOATING MOOD EMBLEMS ================= */}
            {isThinking && (
              <g className="thought-bubble">
                <rect x="25" y="7" width="1" height="1" fill="#cbd5e1" />
                <rect x="27" y="5" width="2" height="2" fill="#94a3b8" />
                <rect x="29" y="3" width="1" height="1" fill="#cbd5e1" />
              </g>
            )}

            {isConfused && (
              <g className="confused-question">
                <path
                  d="M26 4H29V6H28V7H27V9H28V8H29V5H26V4ZM27 10H28V11H27V10Z"
                  fill="#facc15"
                />
              </g>
            )}

            {(isGreeting || isHappy) && (
              <g className={isGreeting ? 'greeting-sparkle' : 'happy-sparkle'}>
                <rect x="26" y="8" width="1" height="3" fill="#38bdf8" />
                <rect x="25" y="9" width="3" height="1" fill="#38bdf8" />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
