import { X, Minus, Square, Maximize2 } from 'lucide-react';
import type { WindowProps } from '../../types/desktop';

interface WindowControlsProps extends Pick<WindowProps, 'onClose' | 'onMinimize' | 'onMaximize' | 'isMaximized'> {}

export function WindowControls({ onClose, onMinimize, onMaximize, isMaximized }: WindowControlsProps) {
  return (
    <div
      className="window-controls"
      role="group"
      aria-label="Window controls"
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        className="window-control minimize"
        onClick={onMinimize}
        aria-label="Minimize"
        title="Minimize"
      >
        <Minus size={12} strokeWidth={2.5} />
      </button>
      <button
        className="window-control maximize"
        onClick={onMaximize}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? <Maximize2 size={12} strokeWidth={2} /> : <Square size={11} strokeWidth={2} />}
      </button>
      <button
        className="window-control close"
        onClick={onClose}
        aria-label="Close"
        title="Close"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}