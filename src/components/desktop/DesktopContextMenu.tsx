import { useEffect, useRef, useLayoutEffect, useState } from 'react';
import {
  RefreshCw,
  LayoutGrid,
  Terminal,
  FolderOpen,
  Palette,
  Settings,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import type { DesktopIcon } from '../../types/desktop';
import './Desktop.css';

export interface DesktopContextMenuProps {
  x: number;
  y: number;
  targetIcon?: DesktopIcon | null;
  onClose: () => void;
  onRefresh: () => void;
  onArrangeIcons: () => void;
  onOpenApp: (appId: string) => void;
  onChangeWallpaper: () => void;
  onResetIconPosition?: (iconId: string) => void;
}

export function DesktopContextMenu({
  x,
  y,
  targetIcon,
  onClose,
  onRefresh,
  onArrangeIcons,
  onOpenApp,
  onChangeWallpaper,
  onResetIconPosition,
}: DesktopContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Viewport bounds clamping
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    let top = y;

    if (left + rect.width > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - rect.width - 8);
    }
    if (top + rect.height > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - rect.height - 8);
    }

    setPosition({ left, top });
  }, [x, y]);

  // Click outside to close
  useEffect(() => {
    function handlePointerDownOutside(e: MouseEvent | PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    // Capture phase ensures we close before other components handle pointer down
    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
    };
  }, [onClose]);

  // Keyboard navigation & Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('.desktop-context-menu-item') || []
      );
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex + 1 >= items.length ? 0 : currentIndex + 1;
        items[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex - 1 < 0 ? items.length - 1 : currentIndex - 1;
        items[prev]?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (targetIcon) {
    return (
      <div
        ref={menuRef}
        className="desktop-context-menu"
        style={{ left: `${position.left}px`, top: `${position.top}px` }}
        role="menu"
        aria-label={`Options for ${targetIcon.label}`}
      >
        <button
          className="desktop-context-menu-item"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenApp(targetIcon.appId);
          }}
          autoFocus
        >
          <span className="desktop-context-menu-icon">
            <ExternalLink size={16} />
          </span>
          <span className="desktop-context-menu-label">Open {targetIcon.label}</span>
        </button>

        <div className="desktop-context-menu-separator" role="separator" />

        <button
          className="desktop-context-menu-item"
          role="menuitem"
          onClick={() => {
            onClose();
            onResetIconPosition?.(targetIcon.id);
          }}
        >
          <span className="desktop-context-menu-icon">
            <RotateCcw size={16} />
          </span>
          <span className="desktop-context-menu-label">Reset Position</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="desktop-context-menu"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      role="menu"
      aria-label="Desktop Context Menu"
    >
      <button
        className="desktop-context-menu-item"
        role="menuitem"
        onClick={() => {
          onClose();
          onRefresh();
        }}
        autoFocus
      >
        <span className="desktop-context-menu-icon">
          <RefreshCw size={16} />
        </span>
        <span className="desktop-context-menu-label">Refresh</span>
      </button>

      <button
        className="desktop-context-menu-item"
        role="menuitem"
        onClick={() => {
          onClose();
          onArrangeIcons();
        }}
      >
        <span className="desktop-context-menu-icon">
          <LayoutGrid size={16} />
        </span>
        <span className="desktop-context-menu-label">Auto-arrange Icons</span>
      </button>

      <div className="desktop-context-menu-separator" role="separator" />

      <button
        className="desktop-context-menu-item"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenApp('terminal');
        }}
      >
        <span className="desktop-context-menu-icon">
          <Terminal size={16} />
        </span>
        <span className="desktop-context-menu-label">Open Terminal</span>
      </button>

      <button
        className="desktop-context-menu-item"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenApp('files');
        }}
      >
        <span className="desktop-context-menu-icon">
          <FolderOpen size={16} />
        </span>
        <span className="desktop-context-menu-label">Open File Manager</span>
      </button>

      <div className="desktop-context-menu-separator" role="separator" />

      <button
        className="desktop-context-menu-item"
        role="menuitem"
        onClick={() => {
          onClose();
          onChangeWallpaper();
        }}
      >
        <span className="desktop-context-menu-icon">
          <Palette size={16} />
        </span>
        <span className="desktop-context-menu-label">Change Wallpaper</span>
      </button>

      <button
        className="desktop-context-menu-item"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenApp('settings');
        }}
      >
        <span className="desktop-context-menu-icon">
          <Settings size={16} />
        </span>
        <span className="desktop-context-menu-label">Settings</span>
      </button>
    </div>
  );
}
