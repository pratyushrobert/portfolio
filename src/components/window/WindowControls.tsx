import { X, Minimize, Maximize, Maximize2 } from 'lucide-react';
import type { WindowProps } from '../../types/desktop';

interface WindowControlsProps extends Pick<WindowProps, 'onClose' | 'onMinimize' | 'onMaximize' | 'isMaximized'> {}

export function WindowControls({ onClose, onMinimize, onMaximize, isMaximized }: WindowControlsProps) {
  return (
    <div className="window-controls" role="group" aria-label="Window controls">
      <button
        className="window-control minimize"
        onClick={onMinimize}
        aria-label="Minimize"
        title="Minimize"
      >
        <Minimize size={12} />
      </button>
      <button
        className="window-control maximize"
        onClick={onMaximize}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? <Maximize2 size={12} /> : <Maximize size={12} />}
      </button>
      <button
        className="window-control close"
        onClick={onClose}
        aria-label="Close"
        title="Close"
      >
        <X size={12} />
      </button>
    </div>
  );
}