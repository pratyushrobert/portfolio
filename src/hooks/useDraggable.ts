import { useRef, useCallback, useEffect } from 'react';
import { useWindowStore } from '../stores/useWindowStore';
import { useDesktopStore } from '../stores/useDesktopStore';

function clampWindowPosition(
  x: number,
  y: number,
  windowWidth: number
): { x: number; y: number } {
  const panelPosition = useDesktopStore.getState().panelPosition || 'top';
  const showPanel = useDesktopStore.getState().showPanel;

  const topInset = showPanel && panelPosition === 'top' ? 40 : 0;
  const bottomInset = showPanel && panelPosition === 'bottom' ? 40 : 0;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Keep at least 60px of the titlebar visible horizontally
  const minX = -(windowWidth - 60);
  const maxX = viewportWidth - 60;

  // Titlebar is 32px tall. Never allow titlebar to go above the top edge / panel
  const minY = topInset;
  const maxY = Math.max(minY, viewportHeight - bottomInset - 32);

  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  };
}

interface UseDraggableOptions {
  windowId: string;
  handleRef?: React.RefObject<HTMLElement | null>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDraggable({
  windowId,
  handleRef,
  onDragStart,
  onDragEnd,
}: UseDraggableOptions) {
  const windowRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    windowX: number;
    windowY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    windowX: 0,
    windowY: 0,
  });

  const { updateWindowPosition, getWindow, focusWindow } = useWindowStore();

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;

      const windowObj = getWindow(windowId);
      if (!windowObj) return;

      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;

      const rawX = dragState.current.windowX + dx;
      const rawY = dragState.current.windowY + dy;

      const clamped = clampWindowPosition(rawX, rawY, windowObj.width);
      updateWindowPosition(windowId, clamped.x, clamped.y);
    },
    [windowId, updateWindowPosition, getWindow]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState.current.isDragging) return;

    dragState.current.isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    onDragEnd?.();
  }, [handleMouseMove, onDragEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (handleRef && handleRef.current && !handleRef.current.contains(e.target as Node)) {
        return;
      }
      // Never start drag if clicking inside window controls or interactive elements
      if ((e.target as HTMLElement).closest('.window-controls')) {
        return;
      }

      const windowObj = getWindow(windowId);
      if (!windowObj || windowObj.isMaximized) return;

      e.preventDefault();
      focusWindow(windowId);
      onDragStart?.();

      dragState.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        windowX: windowObj.x,
        windowY: windowObj.y,
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    },
    [windowId, handleRef, getWindow, focusWindow, onDragStart, handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      dragState.current.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  return { windowRef, handleMouseDown };
}

interface UseResizableOptions {
  windowId: string;
  minWidth?: number;
  minHeight?: number;
}

export function useResizable({ windowId, minWidth = 320, minHeight = 220 }: UseResizableOptions) {
  const { updateWindowSize, getWindow } = useWindowStore();
  const resizeState = useRef<{
    isResizing: boolean;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    direction: 'se' | 's' | 'e';
  }>({
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    direction: 'se',
  });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeState.current.isResizing) return;

      const windowObj = getWindow(windowId);
      if (!windowObj) return;

      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;

      const panelPosition = useDesktopStore.getState().panelPosition || 'top';
      const showPanel = useDesktopStore.getState().showPanel;
      const bottomInset = showPanel && panelPosition === 'bottom' ? 40 : 0;

      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

      const maxWidth = Math.max(minWidth, viewportWidth - windowObj.x);
      const maxHeight = Math.max(minHeight, viewportHeight - windowObj.y - bottomInset);

      let newWidth = resizeState.current.startWidth;
      let newHeight = resizeState.current.startHeight;

      if (resizeState.current.direction === 'se' || resizeState.current.direction === 'e') {
        newWidth = Math.max(minWidth, Math.min(resizeState.current.startWidth + dx, maxWidth));
      }
      if (resizeState.current.direction === 'se' || resizeState.current.direction === 's') {
        newHeight = Math.max(minHeight, Math.min(resizeState.current.startHeight + dy, maxHeight));
      }

      updateWindowSize(windowId, newWidth, newHeight);
    },
    [windowId, minWidth, minHeight, updateWindowSize, getWindow]
  );

  const handleMouseUp = useCallback(() => {
    if (!resizeState.current.isResizing) return;

    resizeState.current.isResizing = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: 'se' | 's' | 'e') => {
      if (e.button !== 0) return;

      const windowObj = getWindow(windowId);
      if (!windowObj || windowObj.isMaximized) return;

      e.preventDefault();
      e.stopPropagation();

      resizeState.current = {
        isResizing: true,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: windowObj.width,
        startHeight: windowObj.height,
        direction,
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor =
        direction === 'se' ? 'se-resize' : direction === 's' ? 's-resize' : 'e-resize';
    },
    [windowId, getWindow, handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      resizeState.current.isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  return { handleMouseDown };
}