import { useRef, useEffect, useState } from 'react';
import { Search, LogOut, Power } from 'lucide-react';
import type { AppDefinition } from '../../types/desktop';
import { useWindowStore } from '../../stores/useWindowStore';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useBootStore } from '../../stores/useBootStore';
import { useFlyoutPlacement } from '../../lib/ui/flyoutPosition';
import { getAppIcon } from '../../lib/icons';
import './Desktop.css';

const APP_DEFINITIONS: AppDefinition[] = [
  { id: 'projects', name: 'Projects', icon: getAppIcon('projects'), component: () => null },
  { id: 'about', name: 'About Me', icon: getAppIcon('about'), component: () => null },
  { id: 'skills', name: 'Skills', icon: getAppIcon('skills'), component: () => null },
  { id: 'experience', name: 'Experience', icon: getAppIcon('experience'), component: () => null },
  { id: 'certificates', name: 'Certificates', icon: getAppIcon('certificates'), component: () => null },
  { id: 'resume', name: 'Resume', icon: getAppIcon('resume'), component: () => null },
  { id: 'contact', name: 'Contact', icon: getAppIcon('contact'), component: () => null },
  { id: 'files', name: 'File Manager', icon: getAppIcon('files'), component: () => null },
  { id: 'terminal', name: 'Terminal', icon: getAppIcon('terminal'), component: () => null },
  { id: 'editor', name: 'Editor', icon: getAppIcon('editor'), component: () => null },
  { id: 'settings', name: 'Settings', icon: getAppIcon('settings'), component: () => null },
  { id: 'snake', name: 'Cyber Snake', icon: getAppIcon('snake'), component: () => null },
];

interface AppLauncherProps {
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function AppLauncher({ onClose, anchorRef }: AppLauncherProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const { openWindowWithParams } = useWindowStore();

  const filteredApps = APP_DEFINITIONS.filter(app =>
    app.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredApps.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredApps[selectedIndex]) {
            launchApp(filteredApps[selectedIndex]);
          }
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredApps.length, selectedIndex, onClose]);

  useEffect(() => {
    listRef.current?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const launchApp = (app: AppDefinition) => {
    const iconComponent = getAppIcon(app.icon || app.id);
    const params = app.id === 'resume' ? { path: '/home/pratyush/resume.pdf' } : undefined;
    openWindowWithParams(
      {
        id: `${app.id}-${Date.now()}`,
        appId: app.id,
        title: app.name,
        icon: iconComponent,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 150,
        width: app.id === 'settings' ? 760 : app.id === 'snake' ? 440 : 800,
        height: app.id === 'settings' ? 520 : app.id === 'snake' ? 520 : 600,
        isMinimized: false,
        isMaximized: false,
      },
      params
    );
    onClose();
  };

  const panelPosition = useDesktopStore((state) => state.panelPosition);
  const panelStyle = useDesktopStore((state) => state.panelStyle ?? 'floating');

  const placement = useFlyoutPlacement({
    anchorRef,
    panelPosition,
    panelStyle,
    preferredWidth: 320,
    preferredHeight: 500,
    align: 'start',
  });

  return (
    <div
      className={`app-launcher ${placement.positionClass}`}
      style={placement.style}
      role="menu"
      aria-label="Applications"
    >
      <div className="launcher-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search applications..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          autoFocus
          aria-label="Search applications"
        />
      </div>
      <ul className="launcher-list" ref={listRef} role="listbox">
        {filteredApps.length === 0 ? (
          <li className="launcher-empty">No applications found</li>
        ) : (
          filteredApps.map((app, index) => {
            const IconComponent = getAppIcon(app.icon || app.id);
            return (
              <li
                key={app.id}
                className={`launcher-item ${index === selectedIndex ? 'selected' : ''}`}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => launchApp(app)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <IconComponent className="launcher-item-icon" size={20} />
                <span className="launcher-item-name">{app.name}</span>
              </li>
            );
          })
        )}
      </ul>
      <div className="launcher-footer">
        <div className="launcher-shortcuts">
          <kbd>Esc</kbd> Close &nbsp;
          <kbd>↑↓</kbd> Navigate &nbsp;
          <kbd>Enter</kbd> Launch
        </div>
        <div className="launcher-power-actions">
          <button
            type="button"
            className="launcher-power-btn"
            onClick={() => {
              onClose();
              useBootStore.getState().logoutToLogin();
            }}
            title="Lock screen / Return to login"
            aria-label="Lock screen"
          >
            <LogOut size={13} />
            <span>Lock</span>
          </button>
          <button
            type="button"
            className="launcher-power-btn danger"
            onClick={() => {
              onClose();
              useBootStore.getState().powerOff();
            }}
            title="Shut Down Machine"
            aria-label="Shut down"
          >
            <Power size={13} />
            <span>Power</span>
          </button>
        </div>
      </div>
    </div>
  );
}