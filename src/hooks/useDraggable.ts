import { useRef, useCallback, useEffect } from 'react';
import type { WindowState } from '../types/desktop';
import { useWindowStore } from '../stores/useWindowStore';

interface UseDraggableOptions {
  windowId: string;
  handleRef?: React.RefObject<HTMLElement>;
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (handleRef && handleRef.current && !handleRef.current.contains(e.target as Node)) {
        return;
      }

      const window = getWindow(windowId);
      if (!window || window.isMaximized) return;

      e.preventDefault();
      focusWindow(windowId);
      onDragStart?.();

      dragState.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        windowX: window.x,
        windowY: window.y,
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    },
    [windowId, handleRef, getWindow, focusWindow, onDragStart]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;

      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;

      const newX = dragState.current.windowX + dx;
      const newY = dragState.current.windowY + dy;

      updateWindowPosition(windowId, newX, newY);
    },
    [windowId, updateWindowPosition]
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

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [handleMouseMove]);

  return { windowRef, handleMouseDown };
}

interface UseResizableOptions {
  windowId: string;
  minWidth?: number;
  minHeight?: number;
}

export function useResizable({ windowId, minWidth = 300, minHeight = 200 }: UseResizableOptions) {
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: 'se' | 's' | 'e') => {
      if (e.button !== 0) return;

      const window = getWindow(windowId);
      if (!window || window.isMaximized) return;

      e.preventDefault();
      e.stopPropagation();

      resizeState.current = {
        isResizing: true,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: window.width,
        startHeight: window.height,
        direction,
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 'se' ? 'se-resize' : direction === 's' ? 's-resize' : 'e-resize';
    },
    [windowId, getWindow]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeState.current.isResizing) return;

      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;

      let newWidth = resizeState.current.startWidth;
      let newHeight = resizeState.current.startHeight;

      if (resizeState.current.direction === 'se' || resizeState.current.direction === 'e') {
        newWidth = Math.max(minWidth, resizeState.current.startWidth + dx);
      }
      if (resizeState.current.direction === 'se' || resizeState.current.direction === 's') {
        newHeight = Math.max(minHeight, resizeState.current.startHeight + dy);
      }

      updateWindowSize(windowId, newWidth, newHeight);
    },
    [windowId, minWidth, minHeight, updateWindowSize]
  );

  const handleMouseUp = useCallback(() => {
    if (!resizeState.current.isResizing) return;

    resizeState.current.isResizing = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  return { handleMouseDown };
}