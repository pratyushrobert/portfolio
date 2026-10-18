import { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  Bluetooth,
  Plane,
  Sun,
  Volume2,
  VolumeX,
  Settings,
  Battery,
  BatteryCharging,
  Lock,
  Power,
  Shield,
  X,
  Check,
  Edit2,
  Sliders,
} from 'lucide-react';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useWindowStore } from '../../stores/useWindowStore';
import { useBootStore } from '../../stores/useBootStore';
import { useAdminAuth, logoutAdmin } from '../../lib/auth/adminAuth';
import { useFlyoutPlacement } from '../../lib/ui/flyoutPosition';
import { getAppIcon } from '../../lib/icons';
import { playVolumeTick, playToggleClick } from '../../lib/audio/soundEffects';
import '../ui/LiquidGlass.css';

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

interface QuickSettingsPanelProps {
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export function QuickSettingsPanel({ onClose, anchorRef }: QuickSettingsPanelProps) {
  const panelPosition = useDesktopStore((state) => state.panelPosition);
  const panelStyle = useDesktopStore((state) => state.panelStyle ?? 'floating');
  const wallpaperBrightness = useDesktopStore((state) => state.wallpaperBrightness ?? 100);
  const setWallpaperBrightness = useDesktopStore((state) => state.setWallpaperBrightness);
  const systemVolume = useDesktopStore((state) => state.systemVolume ?? 80);
  const setSystemVolume = useDesktopStore((state) => state.setSystemVolume);
  const systemMuted = useDesktopStore((state) => state.systemMuted ?? false);
  const toggleSystemMute = useDesktopStore((state) => state.toggleSystemMute);

  const wifiEnabled = useDesktopStore((state) => state.wifiEnabled ?? true);
  const setWifiEnabled = useDesktopStore((state) => state.setWifiEnabled);
  const bluetoothEnabled = useDesktopStore((state) => state.bluetoothEnabled ?? true);
  const setBluetoothEnabled = useDesktopStore((state) => state.setBluetoothEnabled);
  const airplaneMode = useDesktopStore((state) => state.airplaneMode ?? false);
  const setAirplaneMode = useDesktopStore((state) => state.setAirplaneMode);

  const { windows, openWindow, focusWindow, restoreWindow } = useWindowStore();
  const { localUser, setLocalUser, logoutToLogin, powerOff } = useBootStore();
  const { status: adminStatus, user: adminUser } = useAdminAuth();

  // Local state for profile name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(localUser.name || 'Guest');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [batteryState, setBatteryState] = useState<{
    level: number | null;
    charging: boolean;
    supported: boolean;
  }>({
    level: null,
    charging: false,
    supported: false,
  });

  // Query Battery Status API if supported
  useEffect(() => {
    let active = true;
    let batteryManager: BatteryManagerLike | null = null;

    const updateBattery = () => {
      if (!active || !batteryManager) return;
      setBatteryState({
        level: Math.round(batteryManager.level * 100),
        charging: batteryManager.charging,
        supported: true,
      });
    };

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithBattery) : undefined;
    if (typeof nav?.getBattery === 'function') {
      nav
        .getBattery()
        .then((bm) => {
          if (!active) return;
          batteryManager = bm;
          updateBattery();
          bm.addEventListener('levelchange', updateBattery);
          bm.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBattery);
        batteryManager.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  // Keyboard shortcut: Escape closes panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus input when editing name
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleWifiToggle = () => {
    const next = !wifiEnabled;
    setWifiEnabled(next);
    playToggleClick(next);
  };

  const handleBluetoothToggle = () => {
    const next = !bluetoothEnabled;
    setBluetoothEnabled(next);
    playToggleClick(next);
  };

  const handleAirplaneToggle = () => {
    const next = !airplaneMode;
    setAirplaneMode(next);
    playToggleClick(next);
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setWallpaperBrightness(val);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSystemVolume(val);
    playVolumeTick(val);
  };

  const handleMuteToggle = () => {
    toggleSystemMute();
    playToggleClick(!systemMuted);
  };

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    if (trimmed) {
      setLocalUser(trimmed);
    } else {
      setEditedName(localUser.name || 'Guest');
    }
    setIsEditingName(false);
  };

  const handleOpenSettings = () => {
    onClose();
    const existing = windows.find((w) => w.appId === 'settings');
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      }
      focusWindow(existing.id);
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

  const handleOpenAdminPortal = () => {
    onClose();
    const existing = windows.find((w) => w.appId === 'admin-portal');
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      }
      focusWindow(existing.id);
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

  const placement = useFlyoutPlacement({
    anchorRef,
    panelPosition,
    panelStyle,
    preferredWidth: 380,
    preferredHeight: 560,
    align: 'end',
  });

  const isAdmin = adminStatus === 'authenticated' && !!adminUser;
  const userDisplayName = isAdmin
    ? adminUser?.name || adminUser?.email?.split('@')[0] || 'Administrator'
    : localUser?.name || 'Guest';
  const userInitial = userDisplayName.charAt(0).toUpperCase() || 'U';

  const brightnessPercent = Math.round(((wallpaperBrightness - 20) / (100 - 20)) * 100);
  const volumePercent = systemMuted ? 0 : systemVolume;

  return (
    <div
      className={`liquid-glass-flyout qs-control-center-panel ${placement.positionClass}`}
      style={placement.style}
      role="dialog"
      aria-label="Control Center"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header with Title, Battery & Close Action */}
      <div className="qs-panel-header">
        <div className="qs-panel-header-left">
          <div className="qs-panel-header-icon" aria-hidden="true">
            <Sliders size={14} />
          </div>
          <h2 className="qs-panel-title">Control Center</h2>
        </div>

        <div className="qs-panel-header-right">
          {batteryState.supported && batteryState.level !== null && (
            <div
              className="qs-battery-badge"
              title={`Battery: ${batteryState.level}% ${batteryState.charging ? '(Charging)' : ''}`}
              aria-label={`Battery ${batteryState.level} percent`}
            >
              {batteryState.charging ? <BatteryCharging size={12} /> : <Battery size={12} />}
              <span>{batteryState.level}%</span>
            </div>
          )}
          <button
            type="button"
            className="qs-close-btn"
            onClick={onClose}
            aria-label="Close Control Center"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. Dedicated Profile Section */}
      <div className="qs-section-container qs-profile-section" role="region" aria-label="User Profile">
        <div className="qs-profile-card">
          <div className={`qs-profile-avatar ${isAdmin ? 'is-admin' : 'is-guest'}`} aria-hidden="true">
            {isAdmin ? <Shield size={16} /> : <span>{userInitial}</span>}
          </div>

          <div className="qs-profile-meta">
            {isEditingName && !isAdmin ? (
              <div className="qs-profile-name-edit">
                <input
                  ref={nameInputRef}
                  type="text"
                  className="qs-profile-input"
                  value={editedName}
                  maxLength={24}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  aria-label="Display Name"
                />
                <button
                  type="button"
                  className="qs-profile-save-btn"
                  onClick={handleSaveName}
                  title="Save Name"
                  aria-label="Save Name"
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <div className="qs-profile-name-row">
                <span className="qs-profile-name" title={userDisplayName}>
                  {userDisplayName}
                </span>
                {!isAdmin && (
                  <button
                    type="button"
                    className="qs-profile-edit-btn"
                    onClick={() => {
                      setEditedName(localUser.name || 'Guest');
                      setIsEditingName(true);
                    }}
                    title="Edit Guest Display Name"
                    aria-label="Edit Guest Display Name"
                  >
                    <Edit2 size={11} />
                  </button>
                )}
              </div>
            )}

            <div className="qs-profile-role-row">
              <span className={`qs-profile-badge ${isAdmin ? 'admin' : 'guest'}`}>
                {isAdmin ? 'Administrator' : 'Guest Session (Local)'}
              </span>
              {isAdmin && adminUser?.email && (
                <span className="qs-profile-subtext" title={adminUser.email}>
                  {adminUser.email}
                </span>
              )}
            </div>
          </div>

          <div className="qs-profile-actions">
            {isAdmin ? (
              <button
                type="button"
                className="qs-profile-action-btn"
                onClick={handleOpenAdminPortal}
                title="Open Admin Portal"
                aria-label="Open Admin Portal"
              >
                Portal
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                className="qs-profile-action-btn danger"
                onClick={async () => {
                  onClose();
                  await logoutAdmin();
                }}
                title="Sign out of Admin Session"
                aria-label="Sign out of Admin Session"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                className="qs-profile-action-btn"
                onClick={() => {
                  onClose();
                  logoutToLogin();
                }}
                title="Lock Desktop Session"
                aria-label="Lock Desktop Session"
              >
                <Lock size={11} style={{ marginRight: 3 }} />
                Lock
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Connectivity Cards with Honest Browser Telemetry */}
      <div className="qs-section-container" role="region" aria-label="Network & Connectivity">
        <div className="qs-section-heading">
          <span>CONNECTIVITY</span>
        </div>

        {/* 3-Column Toggle Row */}
        <div className="qs-connectivity-grid" role="group" aria-label="Connectivity Toggles">
          {/* Wi-Fi Toggle */}
          <button
            type="button"
            className={`qs-toggle-card ${wifiEnabled && !airplaneMode ? 'is-active' : ''}`}
            onClick={handleWifiToggle}
            disabled={airplaneMode}
            aria-pressed={wifiEnabled && !airplaneMode}
            aria-label={`Wi-Fi: ${airplaneMode ? 'Disabled by Airplane Mode' : wifiEnabled ? 'On' : 'Off'}`}
          >
            <div className="qs-toggle-icon-wrapper">
              {airplaneMode ? (
                <Plane size={16} />
              ) : wifiEnabled ? (
                <Wifi size={16} />
              ) : (
                <WifiOff size={16} />
              )}
            </div>
            <div className="qs-toggle-text-block">
              <span className="qs-toggle-primary-label">Wi-Fi</span>
              <span className="qs-toggle-state-label">
                {airplaneMode ? 'Airplane' : wifiEnabled ? 'Connected' : 'Off'}
              </span>
            </div>
          </button>

          {/* Bluetooth Toggle */}
          <button
            type="button"
            className={`qs-toggle-card ${bluetoothEnabled && !airplaneMode ? 'is-active' : ''}`}
            onClick={handleBluetoothToggle}
            disabled={airplaneMode}
            aria-pressed={bluetoothEnabled && !airplaneMode}
            aria-label={`Bluetooth: ${airplaneMode ? 'Disabled by Airplane Mode' : bluetoothEnabled ? 'On' : 'Off'}`}
          >
            <div className="qs-toggle-icon-wrapper">
              <Bluetooth size={16} />
            </div>
            <div className="qs-toggle-text-block">
              <span className="qs-toggle-primary-label">Bluetooth</span>
              <span className="qs-toggle-state-label">
                {airplaneMode ? 'Airplane' : bluetoothEnabled ? 'On' : 'Off'}
              </span>
            </div>
          </button>

          {/* Airplane Mode Toggle */}
          <button
            type="button"
            className={`qs-toggle-card ${airplaneMode ? 'is-active' : ''}`}
            onClick={handleAirplaneToggle}
            aria-pressed={airplaneMode}
            aria-label={`Airplane Mode: ${airplaneMode ? 'On' : 'Off'}`}
          >
            <div className="qs-toggle-icon-wrapper">
              <Plane size={16} />
            </div>
            <div className="qs-toggle-text-block">
              <span className="qs-toggle-primary-label">Airplane</span>
              <span className="qs-toggle-state-label">{airplaneMode ? 'Active' : 'Off'}</span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Display and Audio Sliders */}
      <div className="qs-section-container" role="region" aria-label="Display & Audio Controls">
        <div className="qs-section-heading">
          <span>DISPLAY & SOUND</span>
        </div>

        <div className="qs-sliders-card">
          {/* Display Brightness Slider */}
          <div className="qs-slider-block">
            <div className="qs-slider-meta-row">
              <div className="qs-slider-title">
                <Sun size={13} className="qs-slider-icon" />
                <span>Display Brightness</span>
              </div>
              <span className="qs-slider-numeric-val">{wallpaperBrightness}%</span>
            </div>

            <div className="qs-slider-track-wrap">
              <input
                type="range"
                min="20"
                max="100"
                value={wallpaperBrightness}
                onChange={handleBrightnessChange}
                className="qs-slider-input"
                style={{ '--fill-percent': `${brightnessPercent}%` } as React.CSSProperties}
                aria-label="Display Brightness"
                aria-valuenow={wallpaperBrightness}
                aria-valuemin={20}
                aria-valuemax={100}
              />
            </div>
          </div>

          {/* System Volume Slider */}
          <div className="qs-slider-block">
            <div className="qs-slider-meta-row">
              <div className="qs-slider-title">
                {systemMuted || systemVolume === 0 ? (
                  <VolumeX size={13} className="qs-slider-icon muted" />
                ) : (
                  <Volume2 size={13} className="qs-slider-icon" />
                )}
                <span>MimiOS Volume</span>
              </div>
              <span className="qs-slider-numeric-val">{systemMuted ? 'Muted' : `${systemVolume}%`}</span>
            </div>

            <div className="qs-slider-track-wrap with-mute">
              <button
                type="button"
                className={`qs-mute-toggle-btn ${systemMuted ? 'is-muted' : ''}`}
                onClick={handleMuteToggle}
                title={systemMuted ? 'Unmute Volume' : 'Mute Volume'}
                aria-label={systemMuted ? 'Unmute Volume' : 'Mute Volume'}
              >
                {systemMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={systemMuted ? 0 : systemVolume}
                onChange={handleVolumeChange}
                className="qs-slider-input"
                style={{ '--fill-percent': `${volumePercent}%` } as React.CSSProperties}
                aria-label="MimiOS System Volume"
                aria-valuenow={systemMuted ? 0 : systemVolume}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Footer Quick Actions */}
      <div className="qs-footer-actions" role="toolbar" aria-label="System Actions">
        <button
          type="button"
          className="qs-footer-btn"
          onClick={handleOpenSettings}
          title="Open System Preferences"
          aria-label="Open Settings"
        >
          <Settings size={13} />
          <span>Settings</span>
        </button>

        <div className="qs-footer-right-group">
          <button
            type="button"
            className="qs-footer-btn"
            onClick={() => {
              onClose();
              logoutToLogin();
            }}
            title="Lock Desktop Screen"
            aria-label="Lock screen"
          >
            <Lock size={12} />
            <span>Lock</span>
          </button>
          <button
            type="button"
            className="qs-footer-btn danger"
            onClick={() => {
              onClose();
              powerOff();
            }}
            title="Shut Down MimiOS Environment"
            aria-label="Power Off"
          >
            <Power size={12} />
            <span>Power</span>
          </button>
        </div>
      </div>
    </div>
  );
}
