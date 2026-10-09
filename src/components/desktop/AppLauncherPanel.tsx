import { useRef, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useFlyoutPlacement } from '../../lib/ui/flyoutPosition';
import { getAppIcon } from '../../lib/icons';
import './Desktop.css';
import '../ui/LiquidGlass.css';

export interface RegisteredAppItem {
  id: string;
  name: string;
  iconName: string;
  description: string;
}

export const REGISTERED_APPS: RegisteredAppItem[] = [
  { id: 'mimi-ai', name: 'MimiAI', iconName: 'mimi-ai', description: 'Cyber Ninja Cat AI companion' },
  { id: 'terminal', name: 'Terminal', iconName: 'terminal', description: 'System command shell' },
  { id: 'files', name: 'File Manager', iconName: 'files', description: 'Browse virtual filesystem' },
  { id: 'about', name: 'About Me', iconName: 'about', description: 'Developer biography & profile' },
  { id: 'projects', name: 'Projects', iconName: 'projects', description: 'Featured software portfolio' },
  { id: 'skills', name: 'Skills', iconName: 'skills', description: 'Technical stack & proficiencies' },
  { id: 'experience', name: 'Experience', iconName: 'experience', description: 'Career timeline & achievements' },
  { id: 'certificates', name: 'Certificates', iconName: 'certificates', description: 'Verified credentials & awards' },
  { id: 'resume', name: 'Resume', iconName: 'resume', description: 'Interactive PDF resume viewer' },
  { id: 'editor', name: 'Code Editor', iconName: 'editor', description: 'Lightweight syntax editor' },
  { id: 'settings', name: 'Settings', iconName: 'settings', description: 'System preferences & themes' },
  { id: 'contact', name: 'Contact', iconName: 'contact', description: 'Direct contact channels' },
  { id: 'snake', name: 'Cyber Snake', iconName: 'snake', description: 'Arcade mini-game' },
];

interface AppLauncherPanelProps {
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function AppLauncherPanel({ onClose, anchorRef }: AppLauncherPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { windows, openWindowWithParams, focusWindow, restoreWindow } = useWindowStore();

  const filteredApps = REGISTERED_APPS.filter(
    (app) =>
      app.name.toLowerCase().includes(query.toLowerCase()) ||
      app.description.toLowerCase().includes(query.toLowerCase())
  );

  const panelPosition = useDesktopStore((state) => state.panelPosition);
  const panelStyle = useDesktopStore((state) => state.panelStyle ?? 'floating');

  const placement = useFlyoutPlacement({
    anchorRef,
    panelPosition,
    panelStyle,
    preferredWidth: 460,
    preferredHeight: 500,
    align: 'center',
    offset: 10,
  });

  const launchApp = (app: RegisteredAppItem) => {
    const existing = windows.find((w) => w.appId === app.id);
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      }
      focusWindow(existing.id);
      onClose();
      return;
    }

    const iconComponent = getAppIcon(app.iconName || app.id);
    const params = app.id === 'resume' ? { path: '/home/pratyush/resume.pdf' } : undefined;
    openWindowWithParams(
      {
        id: `${app.id}-${Date.now()}`,
        appId: app.id,
        title: app.name,
        icon: iconComponent,
        x: 100 + Math.random() * 140,
        y: 80 + Math.random() * 100,
        width: app.id === 'mimi-ai' ? 840 : app.id === 'settings' ? 760 : app.id === 'snake' ? 440 : 800,
        height: app.id === 'mimi-ai' ? 620 : app.id === 'settings' ? 520 : app.id === 'snake' ? 520 : 600,
        isMinimized: false,
        isMaximized: false,
      },
      params
    );
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const count = filteredApps.length;
      if (count === 0) return;

      const getCols = () => {
        if (!gridRef.current) return 4;
        const style = window.getComputedStyle(gridRef.current);
        const colString = style.getPropertyValue('grid-template-columns');
        const computedCols = colString.split(' ').filter(Boolean).length;
        return computedCols > 0 ? computedCols : 4;
      };
      const cols = getCols();

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % count);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + count) % count);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => {
          const next = i + cols;
          return next < count ? next : (i % cols);
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => {
          const prev = i - cols;
          return prev >= 0 ? prev : Math.max(0, count - 1 - ((cols - 1) - (i % cols)));
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredApps[selectedIndex]) {
          launchApp(filteredApps[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredApps, selectedIndex, onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <div
      ref={panelRef}
      className={`app-launcher-panel ${placement.positionClass}`}
      style={placement.style}
      role="dialog"
      aria-modal="true"
      aria-label="Applications Launcher"
    >
      {/* Liquid Glass Header */}
      <div className="app-launcher-header">
        <div className="app-launcher-title-row">
          <span className="app-launcher-badge">MimiOS</span>
          <h2 className="app-launcher-title">APPLICATIONS</h2>
          <span className="app-launcher-count">{filteredApps.length} APPS</span>
        </div>

        {/* Quick Filter Search Bar */}
        <div className="app-launcher-search-box">
          <Search size={15} className="app-launcher-search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="text"
            className="app-launcher-search-input"
            placeholder="Search applications..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Search applications"
          />
          {query && (
            <button
              type="button"
              className="app-launcher-search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 4x3 Liquid Glass App Grid */}
      <div className="app-launcher-grid-wrap">
        {filteredApps.length === 0 ? (
          <div className="app-launcher-empty" role="status">
            <span className="app-launcher-empty-label">No applications found matching "{query}"</span>
          </div>
        ) : (
          <div ref={gridRef} className="app-launcher-grid" role="listbox" aria-label="Available Applications">
            {filteredApps.map((app, index) => {
              const IconComp = getAppIcon(app.iconName || app.id);
              const isSelected = index === selectedIndex;
              const isRunning = windows.some((w) => w.appId === app.id);

              return (
                <button
                  key={app.id}
                  type="button"
                  className={`app-grid-tile ${isSelected ? 'is-selected' : ''} ${isRunning ? 'is-running' : ''}`}
                  style={{ '--idx': index } as React.CSSProperties}
                  onClick={() => launchApp(app)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  role="option"
                  aria-selected={isSelected}
                  title={`${app.name}: ${app.description}${isRunning ? ' (Running)' : ''}`}
                >
                  <div className="app-grid-squircle">
                    <IconComp size={28} className="app-grid-symbol" />
                    {isRunning && <span className="app-grid-running-pip" aria-hidden="true" />}
                  </div>
                  <span className="app-grid-label">{app.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Launcher Footer / Keyboard Hints */}
      <div className="app-launcher-footer">
        <div className="app-launcher-shortcuts">
          <kbd>Esc</kbd> Close &nbsp;•&nbsp; <kbd>↑↓←→</kbd> Navigate &nbsp;•&nbsp; <kbd>Enter</kbd> Open
        </div>
      </div>
    </div>
  );
}
