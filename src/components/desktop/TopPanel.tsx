import { useState, useRef, useEffect } from 'react';
import { Menu, X, Terminal, FolderOpen, FileText, Settings, Clock } from 'lucide-react';
import { useDesktopStore, useDesktopActions } from '../../stores/useDesktopStore';
import { useWindowStore } from '../../stores/useWindowStore';
import { AppLauncher } from './AppLauncher';
import './Desktop.css';

export function TopPanel() {
  const { panelPosition, showPanel } = useDesktopStore();
  const { getMinimizedWindows } = useWindowStore();
  const [time, setTime] = useState(new Date());
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [windowMenuOpen, setWindowMenuOpen] = useState<string | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const windowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) {
        setLauncherOpen(false);
      }
      if (windowMenuRef.current && !windowMenuRef.current.contains(e.target as Node)) {
        setWindowMenuOpen(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const minimizedWindows = getMinimizedWindows();

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (date: Date) =>
    date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  if (!showPanel) return null;

  return (
    <div
      className={`desktop-panel ${panelPosition}`}
      role="statusbar"
      aria-label="Desktop panel"
      style={{ '--panel-height': '40px' }}
    >
      <div className="panel-left">
        <button
          ref={launcherRef}
          className="panel-button launcher"
          onClick={() => setLauncherOpen(!launcherOpen)}
          aria-expanded={launcherOpen}
          aria-haspopup="true"
          aria-label="Application launcher"
          title="Applications"
        >
          <Menu size={18} />
        </button>

        {minimizedWindows.length > 0 && (
          <div className="panel-button-group">
            {minimizedWindows.map(w => (
              <button
                key={w.id}
                className={`panel-button window-btn ${w.isFocused ? 'focused' : ''}`}
                onClick={() => {
                  const { focusWindow, updateWindowState } = useWindowStore.getState();
                  updateWindowState(w.id, { isMinimized: false });
                  focusWindow(w.id);
                }}
                title={w.title}
              >
                {w.icon && <w.icon className="panel-btn-icon" size={16} />}
                <span className="panel-btn-label">{w.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel-center">
        <div className="panel-clock" title={formatDate(time)}>
          <Clock size={14} />
          <span>{formatTime(time)}</span>
        </div>
      </div>

      <div className="panel-right">
        <button
          className="panel-button"
          onClick={() => {
            const { openWindow } = useWindowStore.getState();
            openWindow({
              id: `settings-${Date.now()}`,
              appId: 'settings',
              title: 'Settings',
              icon: Settings,
              x: 100,
              y: 100,
              width: 600,
              height: 400,
              isMinimized: false,
              isMaximized: false,
            });
          }}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {launcherOpen && (
        <AppLauncher
          onClose={() => setLauncherOpen(false)}
          anchorRef={launcherRef}
        />
      )}
    </div>
  );
}