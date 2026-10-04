import { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal, FolderOpen, FileText, Settings } from 'lucide-react';
import { useDesktopStore, useDesktopActions } from '../../stores/useDesktopStore';
import { useWindowStore } from '../../stores/useWindowStore';
import type { DesktopIcon } from '../../types/desktop';
import './Desktop.css';

const ICON_COMPONENTS: Record<string, React.ComponentType<{ size?: number }>> = {
  Terminal,
  FolderOpen,
  FileText,
  Settings,
};

// Single authoritative drag state - one ref for the entire desktop
const dragStateRef = {
  id: null as string | null,
  startPointerX: 0,
  startPointerY: 0,
  startIconX: 0,
  startIconY: 0,
};

interface DesktopIconProps {
  icon: DesktopIcon;
  isSelected: boolean;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
}

function DesktopIconItem({ icon, isSelected, onSelect, onDoubleClick }: DesktopIconProps) {
  const IconComponent = ICON_COMPONENTS[icon.icon] || FolderOpen;
  const ref = useRef<HTMLDivElement>(null);
  const { updateIconPosition } = useDesktopActions();

  // Stable handler refs - same functions for all icons
  const handlePointerMoveRef = useRef<(e: PointerEvent) => void>();
  const handlePointerUpRef = useRef<(e: PointerEvent) => void>();

  // Initialize handler refs once per component
  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      if (dragStateRef.id !== icon.id) return;
      e.preventDefault();
      const dx = e.clientX - dragStateRef.startPointerX;
      const dy = e.clientY - dragStateRef.startPointerY;
      const el = ref.current;
      if (el) {
        el.style.left = `${dragStateRef.startIconX + dx}px`;
        el.style.top = `${dragStateRef.startIconY + dy}px`;
      }
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      if (dragStateRef.id !== icon.id) return;
      const el = ref.current;
      if (el) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      const dx = e.clientX - dragStateRef.startPointerX;
      const dy = e.clientY - dragStateRef.startPointerY;
      const finalX = Math.max(0, dragStateRef.startIconX + dx);
      const finalY = Math.max(0, dragStateRef.startIconY + dy);
      updateIconPosition(icon.id, finalX, finalY);
      if (el) {
        el.style.left = `${finalX}px`;
        el.style.top = `${finalY}px`;
      }
      dragStateRef.id = null;
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', handlePointerMoveRef.current!);
      document.removeEventListener('pointerup', handlePointerUpRef.current!);
    };
  }, [icon.id, updateIconPosition]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();

    // Capture pointer on this element
    el.setPointerCapture(e.pointerId);

    // Record drag state
    dragStateRef.id = icon.id;
    dragStateRef.startPointerX = e.clientX;
    dragStateRef.startPointerY = e.clientY;
    dragStateRef.startIconX = icon.x;
    dragStateRef.startIconY = icon.y;

    document.body.style.userSelect = 'none';

    // Add document-level listeners (pointer capture retargets events to element)
    document.addEventListener('pointermove', handlePointerMoveRef.current!);
    document.addEventListener('pointerup', handlePointerUpRef.current!);
  }, [icon.id, icon.x, icon.y]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragStateRef.id === icon.id) {
        dragStateRef.id = null;
        document.body.style.userSelect = '';
        if (handlePointerMoveRef.current) document.removeEventListener('pointermove', handlePointerMoveRef.current);
        if (handlePointerUpRef.current) document.removeEventListener('pointerup', handlePointerUpRef.current);
      }
    };
  }, [icon.id]);

  const handleClick = (e: React.MouseEvent) => {
    if (dragStateRef.id !== icon.id) onSelect(icon.id, e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onDoubleClick(icon.id);
  };

  return (
    <div
      ref={ref}
      className={`desktop-icon ${isSelected ? 'selected' : ''}`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        left: icon.x,
        top: icon.y,
      }}
      tabIndex={0}
      role="button"
      aria-label={icon.label}
      aria-pressed={isSelected}
    >
      <div className="icon-image">
        <IconComponent size={32} />
      </div>
      <span className="icon-label">{icon.label}</span>
    </div>
  );
}

export function DesktopIcons() {
  const icons = useDesktopStore(state => state.icons);
  const { openWindow } = useWindowStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.target === desktopRef.current) {
        setSelectedId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (id: string, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
      setSelectedId(prev => (prev === id ? null : id));
    } else {
      setSelectedId(id);
    }
  };

  const handleDoubleClick = (id: string) => {
    const icon = icons.find(i => i.id === id);
    if (!icon) return;
    openWindow({
      id: `${icon.appId}-${Date.now()}`,
      appId: icon.appId,
      title: icon.label,
      icon: ICON_COMPONENTS[icon.icon] || FolderOpen,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
      width: 800,
      height: 600,
      isMinimized: false,
      isMaximized: false,
    });
  };

  return (
    <div ref={desktopRef} className="desktop-icons" role="list" aria-label="Desktop icons">
      {icons.map(icon => (
        <DesktopIconItem
          key={icon.id}
          icon={icon}
          isSelected={selectedId === icon.id}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
        />
      ))}
    </div>
  );
}