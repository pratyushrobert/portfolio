import { useRef, useEffect, useState } from 'react';
import { X, Terminal, FolderOpen, FileText, Settings, Search } from 'lucide-react';
import type { AppDefinition } from '../../types/desktop';
import { useWindowStore } from '../../stores/useWindowStore';
import './Desktop.css';

const APP_DEFINITIONS: AppDefinition[] = [
  { id: 'terminal', name: 'Terminal', icon: Terminal, component: () => null },
  { id: 'files', name: 'Files', icon: FolderOpen, component: () => null },
  { id: 'editor', name: 'Editor', icon: FileText, component: () => null },
  { id: 'settings', name: 'Settings', icon: Settings, component: () => null },
];

interface AppLauncherProps {
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}

export function AppLauncher({ onClose, anchorRef }: AppLauncherProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const { openWindow } = useWindowStore();

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
    openWindow({
      id: `${app.id}-${Date.now()}`,
      appId: app.id,
      title: app.name,
      icon: app.icon,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
      width: 800,
      height: 600,
      isMinimized: false,
      isMaximized: false,
    });
    onClose();
  };

  const anchor = anchorRef.current;
  const anchorRect = anchor?.getBoundingClientRect();
  const top = anchorRect ? anchorRect.bottom + 4 : 48;
  const left = anchorRect ? anchorRect.left : 16;

  return (
    <div
      className="app-launcher"
      style={{ top, left }}
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
          filteredApps.map((app, index) => (
            <li
              key={app.id}
              className={`launcher-item ${index === selectedIndex ? 'selected' : ''}`}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => launchApp(app)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <app.icon className="launcher-item-icon" size={20} />
              <span className="launcher-item-name">{app.name}</span>
            </li>
          ))
        )}
      </ul>
      <div className="launcher-footer">
        <kbd>Esc</kbd> Close &nbsp;
        <kbd>↑↓</kbd> Navigate &nbsp;
        <kbd>Enter</kbd> Launch
      </div>
    </div>
  );
}