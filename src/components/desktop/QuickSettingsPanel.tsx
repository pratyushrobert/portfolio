import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useWindowStore } from '../../stores/useWindowStore';
import { useBootStore } from '../../stores/useBootStore';
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

  const [batteryState, setBatteryState] = useState<{
    level: number | null;
    charging: boolean;
    supported: boolean;
  }>({
    level: null,
    charging: false,
    supported: false,
  });

  // Safely query Battery Status API if supported
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

  const placement = useFlyoutPlacement({
    anchorRef,
    panelPosition,
    panelStyle,
    preferredWidth: 360,
    preferredHeight: 460,
    align: 'end',
  });

  return (
    <div
      className={`liquid-glass-flyout ${placement.positionClass}`}
      style={placement.style}
      role="dialog"
      aria-label="Quick Settings Control Center"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="liquid-flyout-header">
        <h2 className="liquid-flyout-title">
          <span>Control Center</span>
        </h2>
        {batteryState.supported && batteryState.level !== null && (
          <div className="liquid-flyout-badge" title="Battery Level">
            {batteryState.charging ? (
              <BatteryCharging size={12} style={{ display: 'inline', marginRight: 4 }} />
            ) : (
              <Battery size={12} style={{ display: 'inline', marginRight: 4 }} />
            )}
            <span>{batteryState.level}%</span>
          </div>
        )}
      </div>

      {/* Connectivity 3-Column Toggle Grid */}
      <div className="qs-connectivity-grid" role="group" aria-label="Network & Connectivity">
        {/* Wi-Fi Toggle */}
        <button
          type="button"
          className={`qs-toggle-btn ${wifiEnabled && !airplaneMode ? 'is-active' : ''}`}
          onClick={handleWifiToggle}
          disabled={airplaneMode}
          aria-pressed={wifiEnabled && !airplaneMode}
          aria-label={`Wi-Fi: ${airplaneMode ? 'Disabled by Airplane Mode' : wifiEnabled ? 'On' : 'Off'}`}
        >
          <div className="qs-toggle-icon">
            {wifiEnabled && !airplaneMode ? <Wifi size={14} /> : <WifiOff size={14} />}
          </div>
          <div className="qs-toggle-meta">
            <span className="qs-toggle-name">Wi-Fi</span>
            <span className="qs-toggle-status">
              {airplaneMode ? 'Airplane' : wifiEnabled ? 'Connected' : 'Off'}
            </span>
          </div>
        </button>

        {/* Bluetooth Toggle */}
        <button
          type="button"
          className={`qs-toggle-btn ${bluetoothEnabled && !airplaneMode ? 'is-active' : ''}`}
          onClick={handleBluetoothToggle}
          disabled={airplaneMode}
          aria-pressed={bluetoothEnabled && !airplaneMode}
          aria-label={`Bluetooth: ${airplaneMode ? 'Disabled by Airplane Mode' : bluetoothEnabled ? 'On' : 'Off'}`}
        >
          <div className="qs-toggle-icon">
            <Bluetooth size={14} />
          </div>
          <div className="qs-toggle-meta">
            <span className="qs-toggle-name">Bluetooth</span>
            <span className="qs-toggle-status">
              {airplaneMode ? 'Airplane' : bluetoothEnabled ? 'On' : 'Off'}
            </span>
          </div>
        </button>

        {/* Airplane Mode Toggle */}
        <button
          type="button"
          className={`qs-toggle-btn ${airplaneMode ? 'is-active' : ''}`}
          onClick={handleAirplaneToggle}
          aria-pressed={airplaneMode}
          aria-label={`Airplane Mode: ${airplaneMode ? 'On' : 'Off'}`}
        >
          <div className="qs-toggle-icon">
            <Plane size={14} />
          </div>
          <div className="qs-toggle-meta">
            <span className="qs-toggle-name">Airplane</span>
            <span className="qs-toggle-status">{airplaneMode ? 'On' : 'Off'}</span>
          </div>
        </button>
      </div>

      {/* Sliders Group (Brightness & Volume) */}
      <div className="qs-sliders-group">
        {/* Display Brightness Slider */}
        <div className="qs-slider-row">
          <div className="qs-slider-header">
            <span className="qs-slider-label">
              <Sun size={14} />
              <span>Display Brightness</span>
            </span>
            <span className="qs-slider-val">{wallpaperBrightness}%</span>
          </div>
          <div className="qs-slider-control">
            <input
              type="range"
              min="20"
              max="100"
              value={wallpaperBrightness}
              onChange={handleBrightnessChange}
              className="qs-range-slider"
              aria-label="Display Brightness"
              aria-valuenow={wallpaperBrightness}
              aria-valuemin={20}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* System Audio Volume Slider */}
        <div className="qs-slider-row">
          <div className="qs-slider-header">
            <span className="qs-slider-label">
              {systemMuted || systemVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>MimiOS Volume</span>
            </span>
            <span className="qs-slider-val">{systemMuted ? 'Muted' : `${systemVolume}%`}</span>
          </div>
          <div className="qs-slider-control">
            <button
              type="button"
              className={`qs-slider-mute-btn ${systemMuted ? 'is-muted' : ''}`}
              onClick={handleMuteToggle}
              title={systemMuted ? 'Unmute' : 'Mute'}
              aria-label={systemMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {systemMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={systemMuted ? 0 : systemVolume}
              onChange={handleVolumeChange}
              className="qs-range-slider"
              aria-label="System Volume"
              aria-valuenow={systemMuted ? 0 : systemVolume}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="qs-action-row">
        <button
          type="button"
          className="qs-action-btn"
          onClick={handleOpenSettings}
          title="Open System Settings"
          aria-label="Open Settings"
        >
          <Settings size={13} />
          <span>Settings</span>
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="qs-action-btn"
            onClick={() => {
              onClose();
              useBootStore.getState().logoutToLogin();
            }}
            title="Lock Desktop"
            aria-label="Lock screen"
          >
            <Lock size={12} />
            <span>Lock</span>
          </button>
          <button
            type="button"
            className="qs-action-btn danger"
            onClick={() => {
              onClose();
              useBootStore.getState().powerOff();
            }}
            title="Shut Down MimiOS"
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
