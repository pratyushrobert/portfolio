import { MimiPixelCat } from '../mascot/MimiPixelCat';

export interface MimiMascotProps {
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
    <MimiPixelCat
      size={size}
      mood={isThinking ? 'thinking' : 'idle'}
      className={`mimi-ninja-mascot ${glow ? 'has-glow' : ''} ${className}`}
    />
  );
}

export function MimiMascotIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <MimiMascot size={size} className={className} />;
}
