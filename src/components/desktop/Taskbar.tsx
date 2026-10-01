import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, Terminal, FolderOpen, User, Briefcase, FileText, Image, Video, Settings, Shield, ChevronUp, ChevronDown, Clock, Monitor, WindowMinimize, Maximize2 } from 'lucide-react';
import { useWindowStore } from '../../hooks/useWindows';
import { useAuthStore } from '../../hooks/useAuth';
import { useWallpaper } from './WallpaperProvider';
import { APP_CONFIGS } from '../../types/window';
import './Taskbar.css';

export const Taskbar: React.FC = () => {
  const {
    windows,
    focusedWindowId,
    minimizedOrder,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    closeWindow,
    isWindowOpen,
  } = useWindowStore();

  const { isAuthenticated } = useAuthStore();
  const { wallpapers, currentWallpaper, setCurrentWallpaper, slideshowEnabled, setSlideshow } = useWallpaper();

  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const startMenuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Close start menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (startMenuOpen && startMenuRef.current && !startMenuRef.current.contains(e.target as Node)) {
        if (startButtonRef.current && !startButtonRef.current.contains(e.target as Node)) {
          setStartMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [startMenuOpen]);

  // Get running apps (non-minimized)
  const runningApps = Object.values(windows).filter((w) => w.state !== 'minimized');
  const minimizedApps = minimizedOrder.map((id) => windows[id]).filter(Boolean);

  const toggleWindow = (appId: string) => {
    const window = windows[appId];
    if (!window) return;

    if (window.state === 'minimized') {
      restoreWindow(appId);
    } else if (focusedWindowId === appId) {
      minimizeWindow(appId);
    } else {
      focusWindow(appId);
    }
    setStartMenuOpen(false);
  };

  const launchApp = (appId: keyof typeof APP_CONFIGS) => {
    const { openWindow } = useWindowStore.getState();
    openWindow(appId);
    setStartMenuOpen(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Taskbar */}
      <div className="os-taskbar" role="toolbar" aria-label="Taskbar">
        {/* Start Button */}
        <button
          ref={startButtonRef}
          className={`os-start-button ${startMenuOpen ? 'open' : ''}`}
          onClick={() => setStartMenuOpen(!startMenuOpen)}
          aria-label="Start Menu"
          aria-expanded={startMenuOpen}
          aria-controls="start-menu"
        >
          <Menu className="lucide-icon" size={20} />
        </button>

        {/* Running Apps */}
        <div className="os-taskbar-apps" role="tablist" aria-label="Running applications">
          {runningApps.map((window) => (
            <button
              key={window.id}
              className={`os-taskbar-app ${focusedWindowId === window.id ? 'active' : ''} ${window.state === 'maximized' ? 'maximized' : ''}`}
              onClick={() => toggleWindow(window.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                // Could show context menu here
              }}
              role="tab"
              aria-selected={focusedWindowId === window.id}
              aria-label={`${window.title} ${window.state === 'maximized' ? '(maximized)' : ''}`}
            >
              {window.icon && <i data-lucide={window.icon} className="lucide-icon" size={16} />}
              <span className="os-taskbar-app-title">{window.title}</span>
              {focusedWindowId === window.id && <span className="os-taskbar-indicator" />}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="os-taskbar-spacer" />

        {/* System Tray */}
        <div className="os-taskbar-tray" role="region" aria-label="System tray">
          {/* Wallpaper indicator */}
          <div className="os-tray-item" title={`Wallpaper: ${currentWallpaper?.name || 'Default'}`}>
            <i data-lucide="image" className="lucide-icon" size={14} />
          </div>

          {/* Date/Time */}
          <div className="os-tray-item os-tray-clock" title={formatDate(clock)}>
            <div className="os-tray-time">{formatTime(clock)}</div>
            <div className="os-tray-date">{formatDate(clock)}</div>
          </div>
        </div>
      </div>

      {/* Start Menu */}
      {startMenuOpen && (
        <div
          ref={startMenuRef}
          id="start-menu"
          className="os-start-menu"
          role="menu"
          aria-label="Applications menu"
        >
          <div className="os-start-menu-header">
            <div className="os-start-menu-user">
              <div className="os-start-avatar">P</div>
              <div className="os-start-user-info">
                <span className="os-start-username">Pratyush</span>
                <span className="os-start-status">Available</span>
              </div>
            </div>
            <div className="os-start-menu-pinned">
              {[
                { id: 'terminal', icon: Terminal, label: 'Terminal' },
                { id: 'file-manager', icon: FolderOpen, label: 'Files' },
                { id: 'about', icon: User, label: 'About' },
                { id: 'projects', icon: Briefcase, label: 'Projects' },
                ...(isAuthenticated ? [{ id: 'admin-panel', icon: Shield, label: 'Admin' }] : []),
              ].map((app) => (
                <button
                  key={app.id}
                  className="os-start-pinned-app"
                  onClick={() => launchApp(app.id as keyof typeof APP_CONFIGS)}
                >
                  <app.icon className="lucide-icon" size={18} />
                  <span>{app.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="os-start-menu-divider" />

          <div className="os-start-menu-all-apps">
            <h3>All Applications</h3>
            <div className="os-start-apps-grid">
              {Object.entries(APP_CONFIGS).map(([appId, config]) => (
                <button
                  key={appId}
                  className={`os-start-app ${isWindowOpen(appId) ? 'running' : ''}`}
                  onClick={() => launchApp(appId as keyof typeof APP_CONFIGS)}
                >
                  {config.icon && <i data-lucide={config.icon} className="lucide-icon" size={20} />}
                  <span>{config.title}</span>
                  {isWindowOpen(appId) && <span className="os-start-app-badge">●</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="os-start-menu-divider" />

          <div className="os-start-menu-power">
            <button className="os-start-power-item" onClick={() => setStartMenuOpen(false)}>
              <Settings className="lucide-icon" size={16} />
              <span>Settings</span>
            </button>
            <button className="os-start-power-item danger" onClick={() => setStartMenuOpen(false)}>
              <WindowMinimize className="lucide-icon" size={16} />
              <span>Lock</span>
            </button>
            <button className="os-start-power-item danger" onClick={() => setStartMenuOpen(false)}>
              <X className="lucide-icon" size={16} />
              <span>Shutdown</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};