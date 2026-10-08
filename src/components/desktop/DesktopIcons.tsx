import { useEffect, useRef } from 'react';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { getAppIcon } from '../../lib/icons';
import type { DesktopIcon } from '../../types/desktop';
import './DesktopIcons.css';

interface DesktopIconItemProps {
  icon: DesktopIcon;
  isSelected: boolean;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onContextMenuIcon?: (icon: DesktopIcon, e: React.MouseEvent) => void;
}

function DesktopIconItem({
  icon,
  isSelected,
  onSelect,
  onDoubleClick,
  onContextMenuIcon,
}: DesktopIconItemProps) {
  const IconComponent = getAppIcon(icon.appId || icon.icon);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    onSelect(icon.id, e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onDoubleClick(icon.appId || icon.id);
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
      onDoubleClick(icon.appId || icon.id);
    } else if (e.key === ' ') {
      e.preventDefault();
      onSelect(icon.id);
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      data-icon-id={icon.id}
      className={`desktop-glass-icon ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${icon.label} application shortcut`}
      aria-pressed={isSelected}
    >
      <div className="desktop-glass-box" aria-hidden="true">
        <IconComponent size={26} className="desktop-glass-symbol" />
      </div>
      <span className="desktop-glass-label">{icon.label}</span>
    </button>
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
  const allIcons = useDesktopStore((state) => state.icons);
  const panelPosition = useDesktopStore((state) => state.panelPosition);

  // Desktop shows ONLY Terminal and About Me in a clean centered vertical column
  const desktopApps = ['terminal', 'about'];
  const filtered = allIcons.filter(
    (i) => desktopApps.includes(i.appId || i.id)
  );

  // Maintain canonical order: Terminal first, then About Me
  const orderedIcons = desktopApps
    .map((appId) =>
      filtered.find((i) => (i.appId || i.id) === appId) || {
        id: appId,
        label: appId === 'terminal' ? 'Terminal' : 'About Me',
        icon: appId,
        appId: appId,
        col: 0,
        row: appId === 'terminal' ? 0 : 1,
        x: 0,
        y: 0,
      }
    )
    .filter(Boolean) as DesktopIcon[];

  // Keyboard navigation between the two stacked icons
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
        if (['ArrowDown', 'ArrowUp'].includes(e.key) && orderedIcons.length > 0) {
          e.preventDefault();
          onSelect(orderedIcons[0].id);
        }
        return;
      }

      const currentIndex = orderedIcons.findIndex((i) => i.id === selectedId);
      if (currentIndex === -1) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        const active = orderedIcons[currentIndex];
        onDoubleClick(active.appId || active.id);
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % orderedIcons.length;
        onSelect(orderedIcons[nextIndex].id);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + orderedIcons.length) % orderedIcons.length;
        onSelect(orderedIcons[prevIndex].id);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, orderedIcons, onSelect, onDoubleClick]);

  return (
    <div className="os-desktop-icons" role="region" aria-label="Desktop application shortcuts">
      <div
        className={`os-desktop-minimal-column position-${panelPosition}`}
        role="group"
        aria-label="Desktop shortcuts"
      >
        {orderedIcons.map((icon) => (
          <DesktopIconItem
            key={icon.id}
            icon={icon}
            isSelected={selectedId === icon.id}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            onContextMenuIcon={onContextMenuIcon}
          />
        ))}
      </div>
    </div>
  );
}