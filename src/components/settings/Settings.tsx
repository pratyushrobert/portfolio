import { useState, useEffect, useCallback } from 'react';
import {
  Palette,
  Cpu,
  Info,
  Save,
  RotateCcw,
  Check,
  Loader2,
  Shield,
  Activity,
  RefreshCw,
  Terminal,
  FolderOpen,
  FileText,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code,
} from 'lucide-react';
import { getAppIcon } from '../../lib/icons';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useWindowStore } from '../../stores/useWindowStore';
import { useAdminAuth } from '../../lib/auth/adminAuth';
import { configApi } from '../../lib/api/config';
import { useBuiltInAssets } from '../../lib/admin/useAdminConfig';
import { getApiErrorMessage } from '../../lib/api/client';
import type { DesktopOpenRequest, PanelPosition } from '../../types/desktop';
import './Settings.css';

type SettingsTab = 'appearance' | 'system' | 'about';

interface SettingsProps {
  windowId: string;
  appParams?: Record<string, unknown>;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

interface BackendHealth {
  status: 'online' | 'offline' | 'checking';
  latencyMs?: number;
  timestamp?: number;
  error?: string;
}

const COLOR_PRESETS = [
  { name: 'Pitch Black', hex: '#000000' },
  { name: 'Deep Void', hex: '#08090d' },
  { name: 'Obsidian Dark', hex: '#0d1117' },
  { name: 'Deep Graphite', hex: '#0a0c10' },
  { name: 'Dark Charcoal', hex: '#14171f' },
  { name: 'Slate Void', hex: '#0f172a' },
];

const OVERLAY_OPTIONS = [
  { label: 'None (0%)', value: '' },
  { label: 'Subtle (20%)', value: 'rgba(0, 0, 0, 0.2)' },
  { label: 'Standard (30%)', value: 'rgba(0, 0, 0, 0.3)' },
  { label: 'Medium Dim (50%)', value: 'rgba(0, 0, 0, 0.5)' },
  { label: 'Heavy Dim (70%)', value: 'rgba(0, 0, 0, 0.7)' },
];

export function Settings({ windowId: _windowId, appParams }: SettingsProps) {
  const initialTab = (appParams?.tab as SettingsTab) || 'appearance';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (appParams?.tab) {
      setActiveTab(appParams.tab as SettingsTab);
    }
  }, [appParams?.tab]);

  // Desktop State
  const wallpaper = useDesktopStore(state => state.wallpaper);
  const wallpaperPosition = useDesktopStore(state => state.wallpaperPosition) || 'center';
  const wallpaperSize = useDesktopStore(state => state.wallpaperSize) || 'cover';
  const wallpaperOverlay = useDesktopStore(state => state.wallpaperOverlay) || '';
  const wallpaperColor = useDesktopStore(state => state.wallpaperColor) || '#08090d';
  const panelPosition = useDesktopStore(state => state.panelPosition);
  const panelStyle = useDesktopStore(state => state.panelStyle ?? 'floating');
  const showPanel = useDesktopStore(state => state.showPanel);
  const setBackgroundConfig = useDesktopStore(state => state.setBackgroundConfig);
  const setPanelPosition = useDesktopStore(state => state.setPanelPosition);
  const setPanelStyle = useDesktopStore(state => state.setPanelStyle);
  const togglePanel = useDesktopStore(state => state.togglePanel);

  // Admin Auth State
  const adminAuth = useAdminAuth();
  const isAdmin = adminAuth.status === 'authenticated';

  // Built-in assets
  const { assets } = useBuiltInAssets();
  const imageAssets = assets.filter(a => a.category === 'image');

  // Window store
  const { openWindow } = useWindowStore();

  // Appearance Form State
  const [customImageUrl, setCustomImageUrl] = useState(wallpaper);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Sync custom image url input with wallpaper changes
  useEffect(() => {
    setCustomImageUrl(wallpaper);
  }, [wallpaper]);

  // System Health State
  const [health, setHealth] = useState<BackendHealth>({ status: 'checking' });

  const checkHealth = useCallback(async () => {
    setHealth({ status: 'checking' });
    const start = performance.now();
    try {
      const res = await fetch('/health', { cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json() as { status?: string; timestamp?: number };
        setHealth({
          status: 'online',
          latencyMs: latency,
          timestamp: data.timestamp ?? Date.now(),
        });
      } else {
        setHealth({
          status: 'offline',
          latencyMs: latency,
          error: `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setHealth({
        status: 'offline',
        error: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'system') {
      void checkHealth();
    }
  }, [activeTab, checkHealth]);

  // Handle Wallpaper Change (immediate local preview)
  const handleSetWallpaper = (url: string) => {
    setCustomImageUrl(url);
    setBackgroundConfig({ wallpaper: url });
    setSaveSuccessMessage(null);
  };

  const handleSetColor = (colorHex: string) => {
    setBackgroundConfig({ wallpaperColor: colorHex });
    setSaveSuccessMessage(null);
  };

  const handleSetPosition = (pos: string) => {
    setBackgroundConfig({ wallpaperPosition: pos });
    setSaveSuccessMessage(null);
  };

  const handleSetSize = (sz: string) => {
    setBackgroundConfig({ wallpaperSize: sz });
    setSaveSuccessMessage(null);
  };

  const handleSetOverlay = (ov: string) => {
    setBackgroundConfig({ wallpaperOverlay: ov });
    setSaveSuccessMessage(null);
  };

  // Authoritative Save (Admins only)
  const handleSaveGlobal = async () => {
    if (!isAdmin) return;
    setSavingGlobal(true);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
    try {
      await configApi.saveMany([
        { key: 'wallpaper_url', value: wallpaper, description: 'Desktop wallpaper URL' },
        { key: 'wallpaper_position', value: wallpaperPosition, description: 'Wallpaper position' },
        { key: 'wallpaper_size', value: wallpaperSize, description: 'Wallpaper size' },
        { key: 'wallpaper_overlay', value: wallpaperOverlay, description: 'Wallpaper overlay' },
        { key: 'wallpaper_color', value: wallpaperColor, description: 'Wallpaper fallback color' },
      ]);
      setSaveSuccessMessage('Wallpaper configuration saved permanently to backend database.');
    } catch (err) {
      setSaveErrorMessage(getApiErrorMessage(err));
    } finally {
      setSavingGlobal(false);
    }
  };

  // Reset to default
  const handleResetDefaults = () => {
    setBackgroundConfig({
      wallpaper: '',
      wallpaperPosition: 'center',
      wallpaperSize: 'cover',
      wallpaperOverlay: 'rgba(0, 0, 0, 0.3)',
      wallpaperColor: '#08090d',
    });
    setCustomImageUrl('');
    setSaveSuccessMessage('Reset to OS defaults in current session.');
  };

  // Open App Helper
  const launchApp = (
    appId: string,
    title: string,
    icon?: React.ComponentType<{ size?: number; className?: string }>
  ) => {
    const iconComponent = icon || getAppIcon(appId);
    openWindow({
      id: `${appId}-${Date.now()}`,
      appId,
      title,
      icon: iconComponent,
      x: 120 + Math.random() * 100,
      y: 100 + Math.random() * 80,
      width: 760,
      height: 520,
      isMinimized: false,
      isMaximized: false,
    });
  };

  return (
    <div className="settings-app" role="region" aria-label="MimiOS Settings">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-left">
          <div className="settings-header-icon">
            <Palette size={20} />
          </div>
          <div className="settings-header-titles">
            <h1>Settings</h1>
            <span>System Preferences</span>
          </div>
        </div>
        <div className={`settings-header-badge ${isAdmin ? 'admin' : 'visitor'}`}>
          {isAdmin && <Shield size={14} />}
          <span>{isAdmin ? `Admin: ${adminAuth.user?.name ?? 'Authenticated'}` : 'Visitor Mode'}</span>
        </div>
      </div>

      <div className="settings-body">
        {/* Sidebar */}
        <nav className="settings-sidebar" aria-label="Settings categories">
          <button
            className={`settings-nav-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Palette size={16} />
            <span>Appearance</span>
          </button>
          <button
            className={`settings-nav-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <Cpu size={16} />
            <span>System</span>
          </button>
          <button
            className={`settings-nav-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <Info size={16} />
            <span>About</span>
          </button>
        </nav>

        {/* Main Content */}
        <main className="settings-main">
          {/* ================= APPEARANCE TAB ================= */}
          {activeTab === 'appearance' && (
            <>
              <div className="settings-section-heading">
                <h2>Appearance & Desktop</h2>
                <p>Customize wallpaper, backdrop colors, and system panel arrangement.</p>
              </div>

              {/* Status Alert / Feedback */}
              {saveSuccessMessage && (
                <div className="settings-banner success">
                  <CheckCircle2 size={18} />
                  <div>{saveSuccessMessage}</div>
                </div>
              )}
              {saveErrorMessage && (
                <div className="settings-banner warning">
                  <AlertCircle size={18} />
                  <div>{saveErrorMessage}</div>
                </div>
              )}

              {!isAdmin && (
                <div className="settings-banner info">
                  <Info size={18} />
                  <div>
                    <strong>Visitor Session:</strong> Changes here apply immediately to your active browsing session. Global settings require administrator authentication.
                  </div>
                </div>
              )}

              {/* Wallpaper Live Preview Box */}
              <div className="settings-card">
                <h3 className="settings-card-title">
                  <Palette size={16} />
                  Desktop Wallpaper Preview
                </h3>
                <div
                  className="settings-wallpaper-box"
                  style={{
                    backgroundColor: wallpaperColor,
                    backgroundImage: wallpaper ? `url("${wallpaper}")` : 'none',
                    backgroundSize: wallpaperSize,
                    backgroundPosition: wallpaperPosition,
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  {wallpaperOverlay && (
                    <div
                      className="settings-wallpaper-overlay"
                      style={{ backgroundColor: wallpaperOverlay }}
                    />
                  )}
                  <div className="settings-wallpaper-info">
                    {wallpaper ? `Image: ${wallpaper.split('/').pop()}` : `Solid Color: ${wallpaperColor}`} • {wallpaperSize}
                  </div>
                </div>

                {/* Color Swatches */}
                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Backdrop Color</span>
                    <span>Fallback background or solid desktop tone</span>
                  </div>
                  <div className="settings-swatches">
                    {COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.hex}
                        type="button"
                        className={`settings-swatch ${wallpaperColor === preset.hex ? 'active' : ''}`}
                        style={{ backgroundColor: preset.hex }}
                        onClick={() => handleSetColor(preset.hex)}
                        title={preset.name}
                        aria-label={`Select ${preset.name}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={wallpaperColor}
                      onChange={e => handleSetColor(e.target.value)}
                      title="Custom color picker"
                      style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* Built-in image options if any in VFS */}
                {imageAssets.length > 0 && (
                  <div className="settings-row">
                    <div className="settings-row-label">
                      <span>Built-in Wallpapers</span>
                      <span>Assets discovered from Virtual File System</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {imageAssets.map(img => (
                        <button
                          key={img.id}
                          type="button"
                          className={`settings-btn settings-btn-sm ${wallpaper === img.assetPath ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                          onClick={() => handleSetWallpaper(img.assetPath)}
                        >
                          <ImageIcon size={12} />
                          <span>{img.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Wallpaper URL */}
                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Wallpaper URL</span>
                    <span>Server-hosted or external image path</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="settings-input"
                      placeholder="e.g. /uploads/image.png"
                      value={customImageUrl}
                      onChange={e => setCustomImageUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="settings-btn settings-btn-secondary settings-btn-sm"
                      onClick={() => handleSetWallpaper(customImageUrl)}
                    >
                      <Check size={14} />
                      <span>Apply</span>
                    </button>
                    {wallpaper && (
                      <button
                        type="button"
                        className="settings-btn settings-btn-secondary settings-btn-sm"
                        onClick={() => handleSetWallpaper('')}
                      >
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sizing & Position */}
                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Display Fit (Size)</span>
                    <span>Scaling behavior for wallpaper images</span>
                  </div>
                  <select
                    className="settings-select"
                    value={wallpaperSize}
                    onChange={e => handleSetSize(e.target.value)}
                  >
                    <option value="cover">Cover (Fill Screen)</option>
                    <option value="contain">Contain (Fit to Bounds)</option>
                    <option value="auto">Auto (Original Size)</option>
                  </select>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Alignment (Position)</span>
                    <span>Position origin of background image</span>
                  </div>
                  <select
                    className="settings-select"
                    value={wallpaperPosition}
                    onChange={e => handleSetPosition(e.target.value)}
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                {/* Dimming Overlay */}
                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Overlay Tint</span>
                    <span>Dim overlay for contrast and icon readability</span>
                  </div>
                  <select
                    className="settings-select"
                    value={wallpaperOverlay}
                    onChange={e => handleSetOverlay(e.target.value)}
                  >
                    {OVERLAY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Desktop Panel Settings */}
              <div className="settings-card">
                <h3 className="settings-card-title">
                  <Activity size={16} />
                  Desktop Panel
                </h3>

                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Show System Panel</span>
                    <span>Toggle visibility of the main taskbar</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showPanel}
                    onChange={togglePanel}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Taskbar Mode</span>
                    <span>Choose between floating dock and edge-connected shell</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={`settings-btn settings-btn-sm ${panelStyle === 'floating' ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                      onClick={() => setPanelStyle('floating')}
                    >
                      Floating Dock
                    </button>
                    <button
                      type="button"
                      className={`settings-btn settings-btn-sm ${panelStyle === 'connected' ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                      onClick={() => setPanelStyle('connected')}
                    >
                      Connected Edge
                    </button>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Panel Location</span>
                    <span>Dock panel to screen edge</span>
                  </div>
                  <select
                    className="settings-select"
                    value={panelPosition}
                    onChange={e => setPanelPosition(e.target.value as PanelPosition)}
                  >
                    <option value="top">Top Edge</option>
                    <option value="bottom">Bottom Edge</option>
                    <option value="left">Left Edge</option>
                    <option value="right">Right Edge</option>
                  </select>
                </div>
              </div>

              {/* Action Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={handleResetDefaults}
                >
                  <RotateCcw size={14} />
                  <span>Reset to Defaults</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    className="settings-btn settings-btn-primary"
                    disabled={savingGlobal}
                    onClick={() => void handleSaveGlobal()}
                  >
                    {savingGlobal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Save as Global Wallpaper</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* ================= SYSTEM TAB ================= */}
          {activeTab === 'system' && (
            <>
              <div className="settings-section-heading">
                <h2>System & Runtime Information</h2>
                <p>Architectural specifications, environment parameters, and service health.</p>
              </div>

              {/* Service Health */}
              <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="settings-card-title">
                    <Activity size={16} />
                    Backend Service Status
                  </h3>
                  <button
                    type="button"
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={() => void checkHealth()}
                  >
                    <RefreshCw size={12} className={health.status === 'checking' ? 'animate-spin' : ''} />
                    <span>Check Health</span>
                  </button>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>Service Endpoint</span>
                    <span>Primary Fastify HTTP server</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`settings-health-badge ${health.status}`}>
                      {health.status === 'online' && 'ONLINE (200 OK)'}
                      {health.status === 'offline' && (health.error ?? 'UNREACHABLE')}
                      {health.status === 'checking' && 'CHECKING...'}
                    </span>
                    {health.latencyMs !== undefined && (
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>
                        {health.latencyMs}ms
                      </span>
                    )}
                  </div>
                </div>

                {health.timestamp && (
                  <div className="settings-row">
                    <div className="settings-row-label">
                      <span>Server Clock</span>
                      <span>Authoritative backend timestamp</span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-h)' }}>
                      {new Date(health.timestamp).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Operating System Specifications */}
              <div className="settings-card">
                <h3 className="settings-card-title">
                  <Cpu size={16} />
                  System Architecture
                </h3>

                <div className="settings-info-grid">
                  <div className="settings-info-label">OS Name & Version:</div>
                  <div className="settings-info-value">MimiOS v1.0.0 (Release 2026.10)</div>

                  <div className="settings-info-label">Frontend Platform:</div>
                  <div className="settings-info-value">React 19 • TypeScript 5.8 • Vite 8</div>

                  <div className="settings-info-label">Backend Platform:</div>
                  <div className="settings-info-value">Fastify 5 • Node.js Engine (ESM)</div>

                  <div className="settings-info-label">Database Engine:</div>
                  <div className="settings-info-value">SQLite 3 (better-sqlite3) • WAL Mode</div>

                  <div className="settings-info-label">File System Layer:</div>
                  <div className="settings-info-value">POSIX VirtualFS (Reactive In-Memory)</div>

                  <div className="settings-info-label">Display Window:</div>
                  <div className="settings-info-value">{window.innerWidth} × {window.innerHeight} (DPR {window.devicePixelRatio.toFixed(1)})</div>
                </div>
              </div>

              {/* Security Hardening Summary */}
              <div className="settings-card">
                <h3 className="settings-card-title">
                  <Shield size={16} />
                  Security Framework (Phase 4B Verified)
                </h3>

                <div className="settings-info-grid">
                  <div className="settings-info-label">Authentication:</div>
                  <div className="settings-info-value">Bcrypt (Cost 12) + Constant-Time Comparison</div>

                  <div className="settings-info-label">Session Policy:</div>
                  <div className="settings-info-value">Cryptographic UUIDs • Signed HttpOnly • SameSite=Lax</div>

                  <div className="settings-info-label">Mutation Security:</div>
                  <div className="settings-info-value">Strict Origin & Sec-Fetch-Site Validation Hook</div>

                  <div className="settings-info-label">HTTP Protections:</div>
                  <div className="settings-info-value">Helmet CSP, X-Content-Type: nosniff, SAMEORIGIN</div>

                  <div className="settings-info-label">Upload Integrity:</div>
                  <div className="settings-info-value">Magic-byte MIME verification • Path traversal immune</div>
                </div>
              </div>
            </>
          )}

          {/* ================= ABOUT TAB ================= */}
          {activeTab === 'about' && (
            <>
              <div className="settings-section-heading">
                <h2>About MimiOS</h2>
                <p>An interactive, web-based desktop environment and portfolio operating system.</p>
              </div>

              {/* System Banner Card */}
              <div className="settings-card" style={{ alignItems: 'center', textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Cpu size={28} />
                </div>
                <h3 style={{ margin: '8px 0 2px', fontSize: 18, color: 'var(--text-h)' }}>MimiOS</h3>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  VERSION 1.0.0
                </span>
                <p style={{ maxWidth: 480, fontSize: 13, color: 'var(--text)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  A personal developer workspace and portfolio operating system, featuring Unix-style shell terminal, window management, custom Virtual File System, and administrative capabilities.
                </p>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-h)' }}>
                  Created & Designed by <strong>Pratyush</strong>
                </div>
              </div>

              {/* Built-in Applications Quick Launch */}
              <div className="settings-card">
                <h3 className="settings-card-title">
                  <FolderOpen size={16} />
                  System Applications
                </h3>
                <div className="settings-apps-grid">
                  <button
                    type="button"
                    className="settings-app-card"
                    onClick={() => launchApp('terminal', 'Terminal', Terminal)}
                  >
                    <Terminal size={22} />
                    <span>Terminal</span>
                  </button>
                  <button
                    type="button"
                    className="settings-app-card"
                    onClick={() => launchApp('files', 'File Manager', FolderOpen)}
                  >
                    <FolderOpen size={22} />
                    <span>File Manager</span>
                  </button>
                  <button
                    type="button"
                    className="settings-app-card"
                    onClick={() => launchApp('editor', 'Editor', Code)}
                  >
                    <Code size={22} />
                    <span>Editor</span>
                  </button>
                  <button
                    type="button"
                    className="settings-app-card"
                    onClick={() => launchApp('video-player', 'Video Player', Video)}
                  >
                    <Video size={22} />
                    <span>Video Player</span>
                  </button>
                  <button
                    type="button"
                    className="settings-app-card"
                    onClick={() => launchApp('text-viewer', 'Text Viewer', FileText)}
                  >
                    <FileText size={22} />
                    <span>Text Viewer</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      className="settings-app-card"
                      onClick={() => launchApp('admin-portal', 'Admin Portal', Shield)}
                    >
                      <Shield size={22} />
                      <span>Admin Portal</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Core Technologies */}
              <div className="settings-card">
                <h3 className="settings-card-title">
                  <ExternalLink size={16} />
                  Technology Stack
                </h3>
                <div className="settings-info-grid">
                  <div className="settings-info-label">Language:</div>
                  <div className="settings-info-value">TypeScript (Strict Mode Enabled)</div>

                  <div className="settings-info-label">UI & State:</div>
                  <div className="settings-info-value">React 19, Zustand, SyncExternalStore</div>

                  <div className="settings-info-label">Backend REST:</div>
                  <div className="settings-info-value">Fastify 5 with Zod Validation Middleware</div>

                  <div className="settings-info-label">Icons & Tokens:</div>
                  <div className="settings-info-value">Lucide React • CSS Custom Properties</div>

                  <div className="settings-info-label">Test Automation:</div>
                  <div className="settings-info-value">Vitest Suite (Security & Auth Regression)</div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
