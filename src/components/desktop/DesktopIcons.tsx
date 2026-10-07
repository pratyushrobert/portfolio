import { useRef, useEffect, useCallback } from 'react';
import {
  useDesktopStore,
  xToGridCol,
  yToGridRow,
  gridColToX,
  gridRowToY,
} from '../../stores/useDesktopStore';
import { getAppIcon } from '../../lib/icons';
import type { DesktopIcon, PanelPosition } from '../../types/desktop';
import './Desktop.css';

const DRAG_THRESHOLD = 5;

interface DesktopIconItemProps {
  icon: DesktopIcon;
  isSelected: boolean;
  panelPosition: PanelPosition;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onContextMenuIcon?: (icon: DesktopIcon, e: React.MouseEvent) => void;
}

function DesktopIconItem({
  icon,
  isSelected,
  panelPosition,
  onSelect,
  onDoubleClick,
  onContextMenuIcon,
}: DesktopIconItemProps) {
  const IconComponent = getAppIcon(icon.appId || icon.icon);
  const ref = useRef<HTMLDivElement>(null);
  const moveIconWithCollision = useDesktopStore(state => state.moveIconWithCollision);

  const sessionRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    isDragging: boolean;
    pointerId: number;
  } | null>(null);

  const justDraggedRef = useRef(false);

  // Stable handler refs
  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | undefined>(undefined);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | undefined>(undefined);

  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;

      if (!session.isDragging) {
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          session.isDragging = true;
          document.body.style.userSelect = 'none';
          ref.current?.classList.add('dragging');
          try {
            ref.current?.setPointerCapture(session.pointerId);
          } catch {
            // ignore pointer capture errors
          }
        }
      }

      if (session.isDragging && ref.current) {
        e.preventDefault();
        ref.current.style.left = `${session.originX + dx}px`;
        ref.current.style.top = `${session.originY + dy}px`;
      }
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      if (session.isDragging) {
        try {
          ref.current?.releasePointerCapture(session.pointerId);
        } catch {
          // ignore
        }
        document.body.style.userSelect = '';
        ref.current?.classList.remove('dragging');

        const dx = e.clientX - session.startX;
        const dy = e.clientY - session.startY;
        const rawX = session.originX + dx;
        const rawY = session.originY + dy;

        // Deterministically compute target grid cell
        const targetCol = Math.max(0, xToGridCol(rawX, panelPosition));
        const targetRow = Math.max(0, yToGridRow(rawY, panelPosition));
        const snappedX = gridColToX(targetCol, panelPosition);
        const snappedY = gridRowToY(targetRow, panelPosition);

        // Immediately update DOM style to avoid remaining at raw dragged coordinates
        if (ref.current) {
          ref.current.style.left = `${snappedX}px`;
          ref.current.style.top = `${snappedY}px`;
        }

        // Commit change to authoritative store
        moveIconWithCollision(icon.id, targetCol, targetRow, icon.col, icon.row);

        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 80);
      }

      sessionRef.current = null;
      if (handlePointerMoveRef.current) {
        document.removeEventListener('pointermove', handlePointerMoveRef.current);
      }
      if (handlePointerUpRef.current) {
        document.removeEventListener('pointerup', handlePointerUpRef.current);
      }
    };
  }, [icon.id, icon.col, icon.row, panelPosition, moveIconWithCollision]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary button initiates drag
    sessionRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: icon.x,
      originY: icon.y,
      isDragging: false,
      pointerId: e.pointerId,
    };

    document.addEventListener('pointermove', handlePointerMoveRef.current!);
    document.addEventListener('pointerup', handlePointerUpRef.current!);
  }, [icon.x, icon.y]);

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current = null;
        document.body.style.userSelect = '';
        if (handlePointerMoveRef.current) {
          document.removeEventListener('pointermove', handlePointerMoveRef.current);
        }
        if (handlePointerUpRef.current) {
          document.removeEventListener('pointerup', handlePointerUpRef.current);
        }
      }
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (justDraggedRef.current) return;
    onSelect(icon.id, e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (justDraggedRef.current) return;
    onDoubleClick(icon.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(icon.id, e);
    onContextMenuIcon?.(icon, e);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onDoubleClick(icon.id);
    } else if (e.key === ' ') {
      e.preventDefault();
      onSelect(icon.id);
    }
  };

  return (
    <div
      ref={ref}
      data-icon-id={icon.id}
      className={`desktop-icon ${isSelected ? 'selected' : ''}`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      style={{
        left: `${icon.x}px`,
        top: `${icon.y}px`,
      }}
      tabIndex={0}
      role="button"
      aria-label={icon.label}
      aria-pressed={isSelected}
    >
      <div className="icon-image">
        <IconComponent size={28} />
      </div>
      <span className="icon-label" title={icon.label}>
        {icon.label}
      </span>
    </div>
  );
}

export interface DesktopIconsProps {
  selectedId: string | null;
  onSelect: (id: string | null, e?: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onContextMenuIcon?: (icon: DesktopIcon, e: React.MouseEvent) => void;
}

export function DesktopIcons({
  selectedId,
  onSelect,
  onDoubleClick,
  onContextMenuIcon,
}: DesktopIconsProps) {
  const icons = useDesktopStore(state => state.icons);
  const panelPosition = useDesktopStore(state => state.panelPosition);
  const snapIconsToGrid = useDesktopStore(state => state.snapIconsToGrid);

  // Align and sanitize grid on mount to ensure valid col/row coordinates
  useEffect(() => {
    snapIconsToGrid();
  }, [snapIconsToGrid]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        onSelect(null);
        return;
      }

      if (!selectedId) {
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key) && icons.length > 0) {
          e.preventDefault();
          onSelect(icons[0].id);
        }
        return;
      }

      const currentIndex = icons.findIndex(i => i.id === selectedId);
      if (currentIndex === -1) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        onDoubleClick(selectedId);
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % icons.length;
        onSelect(icons[nextIndex].id);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + icons.length) % icons.length;
        onSelect(icons[prevIndex].id);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, icons, onSelect, onDoubleClick]);

  const handleSelectIcon = (id: string, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
      onSelect(selectedId === id ? null : id, e);
    } else {
      onSelect(id, e);
    }
  };

  return (
    <div className="desktop-icons" role="list" aria-label="Desktop icons">
      {icons.map(icon => (
        <DesktopIconItem
          key={icon.id}
          icon={icon}
          panelPosition={panelPosition}
          isSelected={selectedId === icon.id}
          onSelect={handleSelectIcon}
          onDoubleClick={onDoubleClick}
          onContextMenuIcon={onContextMenuIcon}
        />
      ))}
    </div>
  );
}