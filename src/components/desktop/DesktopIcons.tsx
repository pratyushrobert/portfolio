import { useRef, useEffect, useState } from 'react';
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

interface DesktopIconProps {
  icon: DesktopIcon;
  isSelected: boolean;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
}

function DesktopIconItem({ icon, isSelected, onSelect, onDoubleClick, onDragStart }: DesktopIconProps) {
  const IconComponent = ICON_COMPONENTS[icon.icon] || FolderOpen;
  const ref = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{ startX: number; startY: number } | null>(null);
  const { updateIconPosition } = useDesktopActions();

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragState) return;
      e.preventDefault();
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      ref.current!.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    function handleMouseUp(e: MouseEvent) {
      if (!dragState) return;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      updateIconPosition(icon.id, Math.max(0, icon.x + dx), Math.max(0, icon.y + dy));
      ref.current!.style.transform = '';
      setDragState(null);
    }
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [dragState, icon.id, icon.x, icon.y, updateIconPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragState({ startX: e.clientX, startY: e.clientY });
    onDragStart(icon.id, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!dragState) onSelect(icon.id, e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onDoubleClick(icon.id);
  };

  return (
    <div
      ref={ref}
      className={`desktop-icon ${isSelected ? 'selected' : ''}`}
      onMouseDown={handleMouseDown}
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

  const handleDragStart = (id: string) => {
    setSelectedId(id);
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
          onDragStart={handleDragStart}
        />
      ))}
    </div>
  );
}