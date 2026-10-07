import { useEffect, useRef, useCallback } from 'react';
import { useDraggable, useResizable } from '../../hooks/useDraggable';
import { WindowControls } from './WindowControls';
import type { WindowState } from '../../types/desktop';
import { useWindowStore } from '../../stores/useWindowStore';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { getAppIcon } from '../../lib/icons';
import './Window.css';

interface WindowContainerProps {
  window: WindowState;
  children: React.ReactNode;
}

export function WindowContainer({ window, children }: WindowContainerProps) {
  const {
    id,
    appId,
    title,
    icon,
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
  const panelPosition = useDesktopStore(state => state.panelPosition);
  const panelStyle = useDesktopStore(state => state.panelStyle ?? 'floating');
  const showPanel = useDesktopStore(state => state.showPanel);

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
    if (isFocused && !isMinimized) {
      document.addEventListener('keydown', handleKeyDown);
      windowRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, isMinimized, handleKeyDown, windowRef]);

  const panelH = panelStyle === 'floating' ? 50 : 42;
  const panelW = panelStyle === 'floating' ? 56 : 48;

  let maxLeft: number | string = 0;
  let maxTop: number | string = 0;
  let maxWidth: number | string = '100vw';
  let maxHeight: number | string = '100vh';

  if (showPanel) {
    if (panelPosition === 'top') {
      maxTop = `${panelH}px`;
      maxHeight = `calc(100vh - ${panelH}px)`;
    } else if (panelPosition === 'bottom') {
      maxHeight = `calc(100vh - ${panelH}px)`;
    } else if (panelPosition === 'left') {
      maxLeft = `${panelW}px`;
      maxWidth = `calc(100vw - ${panelW}px)`;
    } else if (panelPosition === 'right') {
      maxWidth = `calc(100vw - ${panelW}px)`;
    }
  }

  const style: React.CSSProperties = {
    display: isMinimized ? 'none' : 'flex',
    left: isMaximized ? maxLeft : x,
    top: isMaximized ? maxTop : y,
    width: isMaximized ? maxWidth : width,
    height: isMaximized ? maxHeight : height,
    zIndex,
  };

  const renderIcon = () => {
    const Comp = getAppIcon(icon || appId);
    return <Comp className="window-icon" size={16} />;
  };

  return (
    <div
      ref={windowRef}
      className={`window ${isFocused ? 'focused' : ''} ${isMaximized ? 'maximized' : ''}`}
      style={style}
      role="dialog"
      aria-label={title}
      tabIndex={0}
      onMouseDown={() => focusWindow(id)}
      onKeyDown={e => handleKeyDown(e.nativeEvent)}
    >
      <div
        ref={titleBarRef}
        className="window-titlebar"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => maximizeWindow(id)}
      >
        <div className="window-titlebar-left">
          {renderIcon()}
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
}