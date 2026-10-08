import { useRef, useEffect, useState } from 'react';
import {
  Terminal as TerminalIcon,
  Network,
  ShieldAlert,
  Activity,
  Binary,
  Radio,
  FileCode,
  Award,
  Search,
  LogOut,
  Power,
  Shield,
} from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useBootStore } from '../../stores/useBootStore';
import { useFlyoutPlacement } from '../../lib/ui/flyoutPosition';
import { getAppIcon } from '../../lib/icons';
import './Desktop.css';
import '../ui/LiquidGlass.css';

export interface CyberToolItem {
  id: string;
  name: string;
  category: 'core' | 'security';
  description: string;
  command?: string;
  badge: 'ONLINE' | 'SIMULATION' | 'MISSION';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const CYBER_TOOLS: CyberToolItem[] = [
  {
    id: 'terminal',
    name: 'Terminal',
    category: 'core',
    description: 'System Shell (Interactive zsh/bash session)',
    badge: 'ONLINE',
    icon: TerminalIcon,
  },
  {
    id: 'netscan',
    name: 'Network Scanner',
    category: 'security',
    description: 'Scan virtual subnets & probe loopback node',
    command: 'scan localhost',
    badge: 'SIMULATION',
    icon: Network,
  },
  {
    id: 'portscan',
    name: 'Port Scanner',
    category: 'security',
    description: 'Audit listening TCP/UDP service ports & banners',
    command: 'scan demo-server',
    badge: 'SIMULATION',
    icon: ShieldAlert,
  },
  {
    id: 'packetmon',
    name: 'Packet Monitor',
    category: 'security',
    description: 'Live packet telemetry & protocol frame inspector',
    command: 'packetmon',
    badge: 'SIMULATION',
    icon: Activity,
  },
  {
    id: 'hash',
    name: 'Hash Analyzer',
    category: 'security',
    description: 'Cryptographic digest calculator (SHA-256 / SHA-512)',
    command: 'hash sha256 MimiOS-Kernel-v2.0',
    badge: 'SIMULATION',
    icon: Binary,
  },
  {
    id: 'wifiscan',
    name: 'WiFi Analyzer',
    category: 'security',
    description: '802.11 ax/ac band audit & wireless telemetry',
    command: 'wifiscan',
    badge: 'SIMULATION',
    icon: Radio,
  },
  {
    id: 'seclog',
    name: 'Security Log Viewer',
    category: 'security',
    description: 'Journalctl audit trail & PAM authentication journal',
    command: 'seclog',
    badge: 'SIMULATION',
    icon: FileCode,
  },
  {
    id: 'challenge',
    name: 'Cyber Challenges',
    category: 'security',
    description: 'Interactive CTF puzzle missions & cipher decoding',
    command: 'challenge',
    badge: 'MISSION',
    icon: Award,
  },
];

interface AppLauncherProps {
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function AppLauncher({ onClose, anchorRef }: AppLauncherProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { windows, openWindowWithParams, focusWindow, restoreWindow } = useWindowStore();

  const filteredTools = CYBER_TOOLS.filter(
    (tool) =>
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.description.toLowerCase().includes(query.toLowerCase()) ||
      tool.badge.toLowerCase().includes(query.toLowerCase())
  );

  const panelPosition = useDesktopStore((state) => state.panelPosition);
  const panelStyle = useDesktopStore((state) => state.panelStyle ?? 'floating');

  const placement = useFlyoutPlacement({
    anchorRef,
    panelPosition,
    panelStyle,
    preferredWidth: 360,
    preferredHeight: 540,
    align: 'start',
    offset: 10,
  });

  const launchTool = (tool: CyberToolItem) => {
    // If launching default shell and an empty terminal is open, focus it
    if (!tool.command) {
      const existing = windows.find((w) => w.appId === 'terminal' && !w.appParams?.command);
      if (existing) {
        if (existing.isMinimized) {
          restoreWindow(existing.id);
        }
        focusWindow(existing.id);
        onClose();
        return;
      }
    }

    openWindowWithParams(
      {
        id: `terminal-${tool.id}-${Date.now()}`,
        appId: 'terminal',
        title: tool.command ? `Terminal — ${tool.name}` : 'Terminal',
        icon: getAppIcon('terminal'),
        x: 100 + Math.random() * 120,
        y: 80 + Math.random() * 80,
        width: 820,
        height: 520,
        isMinimized: false,
        isMaximized: false,
      },
      tool.command ? { command: tool.command } : undefined
    );
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredTools.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredTools[selectedIndex]) {
            launchTool(filteredTools[selectedIndex]);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredTools, selectedIndex, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <div
      className={`cyber-tools-menu ${placement.positionClass}`}
      style={placement.style}
      role="dialog"
      aria-modal="true"
      aria-label="MimiOS Cyber & System Tools"
    >
      {/* Menu Header with technical branding */}
      <div className="cyber-tools-header">
        <div className="cyber-tools-title-row">
          <div className="cyber-tools-brand">
            <Shield size={14} className="cyber-tools-shield-icon" aria-hidden="true" />
            <span className="cyber-tools-title">MIMIOS CYBER TOOLS</span>
          </div>
          <span className="cyber-tools-sys-badge">SYS 2.0</span>
        </div>

        {/* Filter Input */}
        <div className="cyber-tools-search">
          <Search size={14} className="cyber-tools-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search cyber & system tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Filter cyber tools"
          />
        </div>
      </div>

      {/* Tool List grouped by section */}
      <div className="cyber-tools-list-wrap" ref={listRef} role="listbox">
        {filteredTools.length === 0 ? (
          <div className="cyber-tools-empty" role="status">
            No matching tools found
          </div>
        ) : (
          filteredTools.map((tool, index) => {
            const Icon = tool.icon;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={tool.id}
                type="button"
                className={`cyber-tool-item ${isSelected ? 'selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => launchTool(tool)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="cyber-tool-icon-box">
                  <Icon size={16} className="cyber-tool-icon" />
                </div>
                <div className="cyber-tool-info">
                  <div className="cyber-tool-name-row">
                    <span className="cyber-tool-name">{tool.name}</span>
                    <span className={`cyber-tool-badge badge-${tool.badge.toLowerCase()}`}>
                      {tool.badge === 'ONLINE' ? '● ONLINE' : `[${tool.badge}]`}
                    </span>
                  </div>
                  <span className="cyber-tool-desc">{tool.description}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer with Keyboard Hints & Power Controls */}
      <div className="cyber-tools-footer">
        <div className="cyber-tools-shortcuts">
          <kbd>Esc</kbd> Close &nbsp;•&nbsp; <kbd>↑↓</kbd> Select &nbsp;•&nbsp; <kbd>Enter</kbd> Launch
        </div>
        <div className="cyber-tools-actions">
          <button
            type="button"
            className="cyber-power-btn"
            onClick={() => {
              onClose();
              useBootStore.getState().logoutToLogin();
            }}
            title="Lock screen / Return to login"
            aria-label="Lock screen"
          >
            <LogOut size={12} />
            <span>Lock</span>
          </button>
          <button
            type="button"
            className="cyber-power-btn danger"
            onClick={() => {
              onClose();
              useBootStore.getState().powerOff();
            }}
            title="Shut Down System"
            aria-label="Shut down"
          >
            <Power size={12} />
            <span>Power</span>
          </button>
        </div>
      </div>
    </div>
  );
}