import { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Settings,
  Clock,
  Wifi,
  WifiOff,
  Plane,
  Volume2,
  VolumeX,
  Battery,
  BatteryCharging,
  Shield,
  User,
} from 'lucide-react';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useWindowStore } from '../../stores/useWindowStore';
import { useBootStore } from '../../stores/useBootStore';
import { useAdminAuth } from '../../lib/auth/adminAuth';
import { AppLauncher } from './AppLauncher';
import { AppLauncherPanel } from './AppLauncherPanel';
import { QuickSettingsPanel } from './QuickSettingsPanel';
import { CalendarPanel } from './CalendarPanel';
import { getAppIcon } from '../../lib/icons';
import type { WindowState } from '../../types/desktop';
import '../ui/LiquidGlass.css';
import './Desktop.css';

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

type ActivePanel = 'none' | 'cyber_menu' | 'app_launcher' | 'calendar' | 'quick_settings';

/* ================= 9-DOT MINIMAL APP LAUNCHER ICON ================= */
function NineDotsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="3.5" r="1.5" />
      <circle cx="9" cy="3.5" r="1.5" />
      <circle cx="14.5" cy="3.5" r="1.5" />
      <circle cx="3.5" cy="9" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="14.5" cy="9" r="1.5" />
      <circle cx="3.5" cy="14.5" r="1.5" />
      <circle cx="9" cy="14.5" r="1.5" />
      <circle cx="14.5" cy="14.5" r="1.5" />
    </svg>
  );
}

/* ================= COMPACT INTERACTIVE SYSTEM CLOCK BUTTON ================= */
function SystemClockButton({
  onClick,
  isActive,
  buttonRef,
}: {
  onClick: () => void;
  isActive: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;

  const dateShort = time.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const fullDateString = time.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`panel-clock-button ${isActive ? 'active' : ''}`}
      onClick={onClick}
      aria-expanded={isActive}
      aria-haspopup="dialog"
      aria-label={`System clock and calendar: ${timeString}, ${fullDateString}`}
      title={`${fullDateString} (Click to open Calendar)`}
    >
      <Clock size={13} className="panel-clock-icon" />
      <span className="panel-clock-time">{timeString}</span>
      <span className="panel-clock-date-divider" aria-hidden="true" />
      <span className="panel-clock-date">{dateShort}</span>
    </button>
  );
}

/* ================= SYSTEM STATUS CONTROL CENTER PILL ================= */
function QuickSettingsTrayPill({
  onClick,
  isActive,
  buttonRef,
}: {
  onClick: () => void;
  isActive: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const wifiEnabled = useDesktopStore((s) => s.wifiEnabled ?? true);
  const airplaneMode = useDesktopStore((s) => s.airplaneMode ?? false);
  const systemVolume = useDesktopStore((s) => s.systemVolume ?? 80);
  const systemMuted = useDesktopStore((s) => s.systemMuted ?? false);

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [batteryState, setBatteryState] = useState<{
    level: number | null;
    charging: boolean;
    supported: boolean;
  }>({ level: null, charging: false, supported: false });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let bmRef: BatteryManagerLike | null = null;
    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithBattery) : undefined;
    if (typeof nav?.getBattery === 'function') {
      nav
        .getBattery()
        .then((bm) => {
          if (!active) return;
          bmRef = bm;
          const update = () => {
            setBatteryState({
              level: Math.round(bm.level * 100),
              charging: bm.charging,
              supported: true,
            });
          };
          update();
          bm.addEventListener('levelchange', update);
          bm.addEventListener('chargingchange', update);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      if (bmRef) {
        bmRef.removeEventListener('levelchange', () => {});
        bmRef.removeEventListener('chargingchange', () => {});
      }
    };
  }, []);

  const isVolumeOff = systemMuted || systemVolume === 0;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`panel-tray-pill ${isActive ? 'active' : ''}`}
      onClick={onClick}
      aria-expanded={isActive}
      aria-haspopup="dialog"
      aria-label="Control Center (Quick Settings)"
      title="Control Center (Quick Settings)"
    >
      {/* Network / Airplane Indicator */}
      <div className="panel-tray-icon">
        {airplaneMode ? (
          <Plane size={13} />
        ) : wifiEnabled && isOnline ? (
          <Wifi size={13} />
        ) : (
          <WifiOff size={13} className="is-disabled" />
        )}
      </div>

      {/* Volume Indicator */}
      <div className="panel-tray-icon">
        {isVolumeOff ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </div>

      {/* Battery Indicator (if supported) */}
      {batteryState.supported && batteryState.level !== null && (
        <div className="panel-tray-icon" title={`Battery: ${batteryState.level}%`}>
          {batteryState.charging ? <BatteryCharging size={13} /> : <Battery size={13} />}
          <span className="panel-tray-battery-val">{batteryState.level}%</span>
        </div>
      )}
    </button>
  );
}

/* ================= ADMIN TRAY BADGE ================= */
function AdminTrayBadge() {
  const { status, user } = useAdminAuth();
  const windows = useWindowStore((state) => state.windows);
  const { openWindow, focusWindow, restoreWindow } = useWindowStore();

  if (status !== 'authenticated') return null;

  const handleClick = () => {
    const existing = windows.find((w) => w.appId === 'admin-portal');
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      } else {
        focusWindow(existing.id);
      }
    } else {
      openWindow({
        id: `admin-portal-${Date.now()}`,
        appId: 'admin-portal',
        title: 'Admin Portal',
        icon: getAppIcon('admin-portal'),
        x: 80,
        y: 80,
        width: 900,
        height: 650,
        isMinimized: false,
        isMaximized: false,
      });
    }
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Admin';

  return (
    <button
      type="button"
      className="panel-badge-item admin-badge"
      onClick={handleClick}
      title={`Admin Session Active: ${user?.email || displayName}`}
      aria-label="Open Admin Portal"
    >
      <Shield size={13} />
      <span className="panel-badge-label">{displayName}</span>
    </button>
  );
}

/* ================= LOCAL USER BADGE ================= */
function LocalUserBadge() {
  const localUser = useBootStore((state) => state.localUser);
  const userName = localUser?.name || 'Guest';

  return (
    <div
      className="panel-badge-item user-badge"
      title={`Session User: ${userName} (Local Account)`}
      aria-label={`Session user: ${userName}`}
      role="status"
    >
      <User size={13} />
      <span className="panel-badge-label">{userName}</span>
    </div>
  );
}

/* ================= SETTINGS SHORTCUT BUTTON ================= */
function SettingsTrayButton() {
  const windows = useWindowStore((state) => state.windows);
  const { openWindow, focusWindow, minimizeWindow, restoreWindow } = useWindowStore();

  const isSettingsOpen = windows.some((w) => w.appId === 'settings' && !w.isMinimized);

  const handleClick = () => {
    const existing = windows.find((w) => w.appId === 'settings');
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      } else if (existing.isFocused) {
        minimizeWindow(existing.id);
      } else {
        focusWindow(existing.id);
      }
    } else {
      openWindow({
        id: `settings-${Date.now()}`,
        appId: 'settings',
        title: 'Settings',
        icon: getAppIcon('settings'),
        x: 100,
        y: 100,
        width: 760,
        height: 520,
        isMinimized: false,
        isMaximized: false,
      });
    }
  };

  return (
    <button
      type="button"
      className={`panel-button ${isSettingsOpen ? 'active' : ''}`}
      onClick={handleClick}
      aria-label="Settings"
      title="Settings"
    >
      <Settings size={15} />
    </button>
  );
}

/* ================= MAIN TOP PANEL / DOCK COMPONENT ================= */
const CORE_PINNED_APPS = [
  { id: 'mimi-ai', name: 'MimiAI', iconName: 'mimi-ai' },
  { id: 'terminal', name: 'Terminal', iconName: 'terminal' },
  { id: 'files', name: 'File Manager', iconName: 'files' },
  { id: 'about', name: 'About Me', iconName: 'about' },
  { id: 'projects', name: 'Projects', iconName: 'projects' },
];

export function TopPanel() {
  const panelPosition = useDesktopStore((s) => s.panelPosition);
  const panelStyle = useDesktopStore((s) => s.panelStyle ?? 'floating');
  const showPanel = useDesktopStore((s) => s.showPanel);
  const windows = useWindowStore((state) => state.windows);
  const { focusWindow, minimizeWindow, restoreWindow, openWindowWithParams } = useWindowStore();

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  const launcherRef = useRef<HTMLButtonElement>(null);
  const appLauncherRef = useRef<HTMLButtonElement>(null);
  const clockRef = useRef<HTMLButtonElement>(null);
  const trayRef = useRef<HTMLButtonElement>(null);

  // Shared moving liquid glass indicator state
  const runningGroupRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activePill, setActivePill] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Custom liquid glass tooltip state
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    placement: 'bottom' | 'top' | 'right' | 'left';
  } | null>(null);

  const showTooltip = (text: string, targetEl: HTMLElement) => {
    const rect = targetEl.getBoundingClientRect();
    if (panelPosition === 'top') {
      setTooltip({
        text,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.bottom + 8),
        placement: 'bottom',
      });
    } else if (panelPosition === 'bottom') {
      setTooltip({
        text,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top - 8),
        placement: 'top',
      });
    } else if (panelPosition === 'left') {
      setTooltip({
        text,
        x: Math.round(rect.right + 8),
        y: Math.round(rect.top + rect.height / 2),
        placement: 'right',
      });
    } else {
      setTooltip({
        text,
        x: Math.round(rect.left - 8),
        y: Math.round(rect.top + rect.height / 2),
        placement: 'left',
      });
    }
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  // Measure and position shared active indicator smoothly
  useEffect(() => {
    const updateActivePill = () => {
      const activeWindow = windows.find((w) => w.isFocused && !w.isMinimized);
      if (!activeWindow) {
        setActivePill(null);
        return;
      }

      const btn = buttonRefs.current[activeWindow.id];
      const group = runningGroupRef.current;
      if (!btn || !group) {
        setActivePill(null);
        return;
      }

      const groupRect = group.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      if (btnRect.width > 0 && btnRect.height > 0) {
        setActivePill({
          left: Math.round(btnRect.left - groupRect.left),
          top: Math.round(btnRect.top - groupRect.top),
          width: Math.round(btnRect.width),
          height: Math.round(btnRect.height),
        });
      }
    };

    updateActivePill();
    const frame = requestAnimationFrame(updateActivePill);

    window.addEventListener('resize', updateActivePill);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateActivePill);
    };
  }, [windows, panelPosition, panelStyle]);

  const isVertical = panelPosition === 'left' || panelPosition === 'right';

  // Global click outside listener: closes whichever panel is open
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        target.closest('.liquid-glass-flyout') ||
        target.closest('.app-launcher-panel') ||
        target.closest('.cyber-tools-menu') ||
        target.closest('.app-launcher') ||
        target.closest('.panel-button.launcher') ||
        target.closest('.panel-9dot-btn') ||
        target.closest('.panel-clock-button') ||
        target.closest('.panel-tray-pill')
      ) {
        return;
      }
      setActivePanel('none');
      hideTooltip();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Escape key listener: closes any active panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActivePanel('none');
        hideTooltip();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePinnedClick = (appId: string, appName: string) => {
    hideTooltip();
    setActivePanel('none');
    const existing = windows.find((w) => w.appId === appId);
    if (existing) {
      if (existing.isFocused && !existing.isMinimized) {
        minimizeWindow(existing.id);
      } else if (existing.isMinimized) {
        restoreWindow(existing.id);
        focusWindow(existing.id);
      } else {
        focusWindow(existing.id);
      }
    } else {
      openWindowWithParams({
        id: `${appId}-${Date.now()}`,
        appId,
        title: appName,
        icon: getAppIcon(appId),
        x: 100 + Math.random() * 80,
        y: 80 + Math.random() * 60,
        width: appId === 'mimi-ai' || appId === 'ai' ? 840 : 800,
        height: appId === 'mimi-ai' || appId === 'ai' ? 620 : 580,
        isMinimized: false,
        isMaximized: false,
      });
    }
  };

  const handleWindowClick = (w: WindowState) => {
    hideTooltip();
    setActivePanel('none');
    if (w.isMinimized) {
      restoreWindow(w.id);
      focusWindow(w.id);
    } else if (w.isFocused) {
      minimizeWindow(w.id);
    } else {
      focusWindow(w.id);
    }
  };

  const renderWindowIcon = (w: WindowState) => {
    const Icon = getAppIcon(w.icon || w.appId);
    return <Icon className="panel-btn-icon" size={15} />;
  };

  if (!showPanel) return null;

  return (
    <>
      <header
        className={`desktop-panel ${panelPosition} ${panelStyle} ${isVertical ? 'vertical' : 'horizontal'}`}
        role="toolbar"
        aria-label="MimiOS Desktop Dock"
        style={
          {
            '--panel-height': '42px',
            '--panel-width': '48px',
          } as React.CSSProperties
        }
      >
        {/* Left Section: MimiOS Cyber & System Tools */}
        <div className="panel-left">
          <button
            ref={launcherRef}
            type="button"
            className={`panel-button launcher ${activePanel === 'cyber_menu' ? 'active' : ''}`}
            onClick={() =>
              setActivePanel((prev) => (prev === 'cyber_menu' ? 'none' : 'cyber_menu'))
            }
            onMouseEnter={(e) => showTooltip('Cyber & System Tools', e.currentTarget)}
            onMouseLeave={hideTooltip}
            aria-expanded={activePanel === 'cyber_menu'}
            aria-haspopup="dialog"
            aria-label="MimiOS Cyber & System Tools"
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Center Section: 9-Dot Launcher, Pinned Core Apps & Running Window Tabs */}
        <div className="panel-center">
          <div className="panel-center-content">
            {/* 9-Dot Central App Launcher Button */}
            <button
              ref={appLauncherRef}
              type="button"
              className={`panel-9dot-btn ${activePanel === 'app_launcher' ? 'active' : ''}`}
              onClick={() =>
                setActivePanel((prev) => (prev === 'app_launcher' ? 'none' : 'app_launcher'))
              }
              onMouseEnter={(e) => showTooltip('Applications Launcher', e.currentTarget)}
              onMouseLeave={hideTooltip}
              aria-expanded={activePanel === 'app_launcher'}
              aria-haspopup="dialog"
              aria-label="Applications Launcher"
            >
              <NineDotsIcon size={16} />
            </button>

            <div className="panel-center-divider" aria-hidden="true" />

            {/* Pinned Applications */}
            <div className="panel-pinned-group" role="group" aria-label="Pinned Applications">
              {CORE_PINNED_APPS.map((app) => {
                const IconComp = getAppIcon(app.iconName);
                const runningWindow = windows.find((w) => w.appId === app.id);
                const isRunning = !!runningWindow;
                const isFocused = isRunning && runningWindow.isFocused && !runningWindow.isMinimized;
                return (
                  <button
                    key={app.id}
                    type="button"
                    className={`panel-pinned-btn ${isRunning ? 'is-running' : ''} ${isFocused ? 'is-focused' : ''}`}
                    onClick={() => {
                      hideTooltip();
                      handlePinnedClick(app.id, app.name);
                    }}
                    onMouseEnter={(e) => showTooltip(app.name, e.currentTarget)}
                    onMouseLeave={hideTooltip}
                    aria-label={`Open ${app.name}`}
                  >
                    <IconComp size={16} />
                  </button>
                );
              })}
            </div>

            {/* Subtle Divider if Running Windows Exist */}
            {windows.length > 0 && <div className="panel-center-divider" aria-hidden="true" />}

            {/* Running Window Tabs */}
            {windows.length > 0 && (
              <div
                ref={runningGroupRef}
                className="panel-button-group"
                role="group"
                aria-label="Running Applications"
              >
                {/* Shared Moving Liquid Glass Active Indicator */}
                <div
                  className={`panel-active-indicator ${activePill ? 'visible' : ''}`}
                  style={
                    activePill
                      ? {
                          transform: `translate3d(${activePill.left}px, ${activePill.top}px, 0)`,
                          width: `${activePill.width}px`,
                          height: `${activePill.height}px`,
                        }
                      : undefined
                  }
                  aria-hidden="true"
                >
                  <div className="panel-active-indicator-highlight" />
                  <div className="panel-active-indicator-reflection" />
                </div>

                {windows.map((w) => {
                  const isActive = w.isFocused && !w.isMinimized;
                  const isMinimized = w.isMinimized;
                  return (
                    <button
                      key={w.id}
                      ref={(el) => {
                        buttonRefs.current[w.id] = el;
                      }}
                      type="button"
                      className={`panel-button window-btn ${isActive ? 'focused' : ''} ${isMinimized ? 'minimized' : ''}`}
                      onClick={() => {
                        hideTooltip();
                        handleWindowClick(w);
                      }}
                      onMouseEnter={(e) => showTooltip(w.title, e.currentTarget)}
                      onMouseLeave={hideTooltip}
                      aria-pressed={isActive}
                      aria-label={`${w.title}${isActive ? ' (active)' : isMinimized ? ' (minimized)' : ''}`}
                    >
                      {renderWindowIcon(w)}
                      <span className="panel-btn-label">{w.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: System Clock, Control Center, Badges & Settings */}
        <div className="panel-right" role="group" aria-label="System Tray Controls">
          {/* Interactive Time / Date Button */}
          <SystemClockButton
            buttonRef={clockRef}
            isActive={activePanel === 'calendar'}
            onClick={() =>
              setActivePanel((prev) => (prev === 'calendar' ? 'none' : 'calendar'))
            }
          />

          {/* Quick Settings Control Center Pill */}
          <QuickSettingsTrayPill
            buttonRef={trayRef}
            isActive={activePanel === 'quick_settings'}
            onClick={() =>
              setActivePanel((prev) => (prev === 'quick_settings' ? 'none' : 'quick_settings'))
            }
          />

          <LocalUserBadge />
          <AdminTrayBadge />
          <SettingsTrayButton />
        </div>
      </header>

      {/* Flyout Panels (Direction-aware and Bounds-clamped) */}
      {activePanel === 'cyber_menu' && (
        <AppLauncher
          onClose={() => setActivePanel('none')}
          anchorRef={launcherRef}
        />
      )}

      {activePanel === 'app_launcher' && (
        <AppLauncherPanel
          onClose={() => setActivePanel('none')}
          anchorRef={appLauncherRef}
        />
      )}

      {activePanel === 'calendar' && (
        <CalendarPanel
          onClose={() => setActivePanel('none')}
          anchorRef={clockRef}
        />
      )}

      {activePanel === 'quick_settings' && (
        <QuickSettingsPanel
          onClose={() => setActivePanel('none')}
          anchorRef={trayRef}
        />
      )}

      {/* Liquid Glass Floating Taskbar Tooltip */}
      {tooltip && (
        <div
          className={`panel-liquid-tooltip from-${tooltip.placement}`}
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
          role="tooltip"
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}