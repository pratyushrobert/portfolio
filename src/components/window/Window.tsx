import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable, useResizable } from '../../hooks/useDraggable';
import { WindowControls } from './WindowControls';
import type { WindowState, WindowProps } from '../../types/desktop';
import { useWindowStore } from '../../stores/useWindowStore';
import './Window.css';

interface WindowContainerProps {
  window: WindowState;
  children: React.ReactNode;
}

export function WindowContainer({ window, children }: WindowContainerProps) {
  const {
    id,
    title,
    icon: IconComponent,
    x,
    y,
    width,
    height,
    isMinimized,
    isMaximized,
    isFocused,
    zIndex,
  } = window;

  const { focusWindow, closeWindow, minimizeWindow, maximizeWindow } = useWindowStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);

  const { windowRef, handleMouseDown } = useDraggable({
    windowId: id,
    handleRef: titleBarRef,
    onDragStart: () => focusWindow(id),
  });

  const { handleMouseDown: handleResize } = useResizable({ windowId: id });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        maximizeWindow(id);
      }
    },
    [id, isMaximized, maximizeWindow]
  );

  useEffect(() => {
    if (isFocused) {
      document.addEventListener('keydown', handleKeyDown);
      windowRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, handleKeyDown]);

  if (isMinimized) return null;

  const style: React.CSSProperties = {
    left: isMaximized ? 0 : x,
    top: isMaximized ? 0 : y,
    width: isMaximized ? '100vw' : width,
    height: isMaximized ? 'calc(100vh - var(--panel-height, 40px))' : height,
    zIndex,
    transform: isMaximized ? 'none' : undefined,
  };

  const windowElement = (
    <div
      ref={windowRef}
      className={`window ${isFocused ? 'focused' : ''} ${isMaximized ? 'maximized' : ''}`}
      style={style}
      role="dialog"
      aria-label={title}
      tabIndex={0}
      onMouseDown={() => focusWindow(id)}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={titleBarRef}
        className="window-titlebar"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => !isMaximized && maximizeWindow(id)}
      >
        <div className="window-titlebar-left">
          {IconComponent && <IconComponent className="window-icon" size={16} />}
          <span className="window-title">{title}</span>
        </div>
        <WindowControls
          onClose={() => closeWindow(id)}
          onMinimize={() => minimizeWindow(id)}
          onMaximize={() => maximizeWindow(id)}
          isMaximized={isMaximized}
        />
      </div>
      <div
        className="window-content"
        ref={contentRef}
        style={{ width: '100%', height: `calc(100% - var(--titlebar-height, 32px))` }}
      >
        {children}
      </div>
      {!isMaximized && (
        <div
          className="window-resize-handle se"
          onMouseDown={e => handleResize(e, 'se')}
          aria-label="Resize diagonally"
        />
      )}
      {!isMaximized && (
        <div
          className="window-resize-handle s"
          onMouseDown={e => handleResize(e, 's')}
          aria-label="Resize vertically"
        />
      )}
      {!isMaximized && (
        <div
          className="window-resize-handle e"
          onMouseDown={e => handleResize(e, 'e')}
          aria-label="Resize horizontally"
        />
      )}
    </div>
  );

  return createPortal(windowElement, document.getElementById('window-layer')!);
}