import type { LucideIcon } from 'lucide-react';

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export function Icon({
  icon: IconComponent,
  size = 18,
  color = '#cdd6f4',
  strokeWidth = 2,
  className,
}: IconProps) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        display: 'inline-flex',
        flexShrink: 0,
        opacity: 1,
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
      aria-hidden="true"
    >
      <IconComponent
        width={size}
        height={size}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          display: 'block',
          flexShrink: 0,
          opacity: 1,
        }}
      />
    </span>
  );
}