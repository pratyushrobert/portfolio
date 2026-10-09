interface MimiMascotProps {
  size?: number;
  className?: string;
  isThinking?: boolean;
  glow?: boolean;
}

export function MimiMascot({
  size = 28,
  className = '',
  isThinking = false,
  glow = false,
}: MimiMascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mimi-ninja-mascot ${isThinking ? 'is-thinking' : ''} ${className}`}
      aria-label="MimiAI — Cyber Ninja Cat"
      role="img"
    >
      <defs>
        {/* Charcoal & Graphite Body Gradient */}
        <linearGradient id="mimiHeadGrad" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#252a38" />
          <stop offset="50%" stopColor="#181c26" />
          <stop offset="100%" stopColor="#0e1118" />
        </linearGradient>

        {/* Ear Inner Shadow */}
        <linearGradient id="mimiEarGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d465c" />
          <stop offset="100%" stopColor="#1e2330" />
        </linearGradient>

        {/* Ninja Headband Metallic Plate */}
        <linearGradient id="mimiPlateGrad" x1="20" y1="22" x2="44" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Cyber Cat Eye Glow */}
        <radialGradient id="mimiEyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#0284c7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
        </radialGradient>

        {/* Specular Highlight Rim */}
        <linearGradient id="mimiRimLight" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Subtle Ninja Aura Glow when thinking */}
      {(glow || isThinking) && (
        <circle cx="32" cy="32" r="28" fill="url(#mimiEyeGlow)" opacity="0.35" />
      )}

      {/* Left Ninja Ear */}
      <path
        d="M12 28L18 7C18.5 5.5 20.5 5 21.5 6.5L30 18L24 28Z"
        fill="url(#mimiHeadGrad)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.2"
      />
      {/* Left Ear Inner Detail */}
      <path d="M16 23L19 11L25 21Z" fill="url(#mimiEarGrad)" />

      {/* Right Ninja Ear */}
      <path
        d="M52 28L46 7C45.5 5.5 43.5 5 42.5 6.5L34 18L40 28Z"
        fill="url(#mimiHeadGrad)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.2"
      />
      {/* Right Ear Inner Detail */}
      <path d="M48 23L45 11L39 21Z" fill="url(#mimiEarGrad)" />

      {/* Head Silhouette Base */}
      <rect
        x="13"
        y="16"
        width="38"
        height="38"
        rx="18"
        fill="url(#mimiHeadGrad)"
        stroke="url(#mimiRimLight)"
        strokeWidth="1.2"
      />

      {/* Ninja Headband Wrap (Horizontal Ribbon) */}
      <path
        d="M13 23C18 21.5 46 21.5 51 23V31C46 29.5 18 29.5 13 31V23Z"
        fill="#11141c"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />

      {/* Headband Ties (Behind/Side) */}
      <path
        d="M51 27C55 28 58 31 60 35C57 34 54 33 51 31Z"
        fill="#1e2330"
        opacity="0.8"
      />
      <path
        d="M51 29C54 32 56 36 57 41C54 39 52 36 51 32Z"
        fill="#141722"
        opacity="0.6"
      />

      {/* Metallic Ninja Forehead Plate */}
      <rect
        x="22"
        y="22.5"
        width="20"
        height="7.5"
        rx="2.5"
        fill="url(#mimiPlateGrad)"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth="0.8"
      />
      {/* Plate Rivets */}
      <circle cx="24.5" cy="26.2" r="0.9" fill="#1e293b" />
      <circle cx="39.5" cy="26.2" r="0.9" fill="#1e293b" />
      {/* Stealth Ninja Paw/Shuriken Emblem on Plate */}
      <path
        d="M32 24.2L33.2 26.2L35.2 26.5L33.6 27.8L34.1 29.8L32 28.6L29.9 29.8L30.4 27.8L28.8 26.5L30.8 26.2Z"
        fill="#0f172a"
        opacity="0.85"
      />

      {/* Eyes: Slit / Glowing Cyber Ninja Visor Look */}
      {/* Left Eye */}
      <ellipse cx="23.5" cy="36" rx="4.5" ry="3.2" fill="#0f172a" />
      <ellipse cx="23.5" cy="36" rx="3.6" ry="2.5" fill="#38bdf8" />
      <ellipse cx="23.5" cy="36" rx="1.2" ry="2.2" fill="#0c1929" />
      {/* Left Eye Reflection */}
      <circle cx="24.8" cy="34.8" r="0.9" fill="#ffffff" />

      {/* Right Eye */}
      <ellipse cx="40.5" cy="36" rx="4.5" ry="3.2" fill="#0f172a" />
      <ellipse cx="40.5" cy="36" rx="3.6" ry="2.5" fill="#38bdf8" />
      <ellipse cx="40.5" cy="36" rx="1.2" ry="2.2" fill="#0c1929" />
      {/* Right Eye Reflection */}
      <circle cx="41.8" cy="34.8" r="0.9" fill="#ffffff" />

      {/* Lower Ninja Cowl / Mask Fold */}
      <path
        d="M16 41C22 43 42 43 48 41C48 48 42 53 32 53C22 53 16 48 16 41Z"
        fill="#12151e"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1"
      />

      {/* Minimal Whisker Marks (Subtle engraved slits) */}
      <line x1="15" y1="44" x2="21" y2="45" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="47" x2="20" y2="47.5" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
      <line x1="49" y1="44" x2="43" y2="45" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
      <line x1="50" y1="47" x2="44" y2="47.5" stroke="#334155" strokeWidth="1" strokeLinecap="round" />

      {/* Mask Stitch/Fold Center Crest */}
      <path
        d="M32 43.5V47.5"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MimiMascotIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <MimiMascot size={size} className={className} />;
}
