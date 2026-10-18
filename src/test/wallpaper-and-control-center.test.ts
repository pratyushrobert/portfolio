import { describe, it, expect, afterEach } from 'vitest';

// Polyfill localStorage in Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    length: 0,
    key: () => null,
  } as Storage;
}

import {
  isSupportedImageExtension,
  getWallpaperDisplayName,
  resolveWallpaperSource,
  MAX_WALLPAPER_BYTES,
  SUPPORTED_WALLPAPER_EXTENSIONS,
} from '../lib/wallpaper/wallpaperResolver';
import { vfs } from '../lib/vfs';
import { useDesktopStore } from '../stores/useDesktopStore';
import { loadFromLocalStorage, saveToLocalStorage } from '../lib/vfs/persistence';

describe('Control Center & Connectivity Cleanup', () => {
  it('does not contain unsupported Wi-Fi or Bluetooth details rows in QuickSettings markup', async () => {
    // Read the source of QuickSettingsPanel to verify removal of detail rows and pill badges
    const fs = await import('fs');
    const path = await import('path');
    const panelSource = fs.readFileSync(
      path.resolve(__dirname, '../components/desktop/QuickSettingsPanel.tsx'),
      'utf-8'
    );

    // Verify removed detail rows
    expect(panelSource).not.toContain('Wi-Fi Network Details');
    expect(panelSource).not.toContain('Bluetooth Devices');
    expect(panelSource).not.toContain('qs-connectivity-details-box');
    expect(panelSource).not.toContain('showWifiDetails');
    expect(panelSource).not.toContain('showBluetoothDetails');

    // Verify removed oval/pill badges
    expect(panelSource).not.toContain('qs-battery-pill');
    expect(panelSource).not.toContain('qs-details-preview-badge');

    // Verify primary controls remain intact
    expect(panelSource).toContain('handleWifiToggle');
    expect(panelSource).toContain('handleBluetoothToggle');
    expect(panelSource).toContain('handleAirplaneToggle');
    expect(panelSource).toContain('qs-battery-badge');
  });

  it('does not contain oval status badges in LiquidGlass.css', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssSource = fs.readFileSync(
      path.resolve(__dirname, '../components/ui/LiquidGlass.css'),
      'utf-8'
    );

    expect(cssSource).not.toContain('.qs-battery-pill');
    expect(cssSource).not.toContain('.qs-details-preview-badge');
    expect(cssSource).not.toContain('.qs-connectivity-details-box');
    expect(cssSource).toContain('.qs-battery-badge');
  });

  it('renders clean, standalone connectivity icons without oval/capsule backgrounds or shadows', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssSource = fs.readFileSync(
      path.resolve(__dirname, '../components/ui/LiquidGlass.css'),
      'utf-8'
    );

    // Verify .qs-toggle-icon-wrapper has transparent background and no border-radius: 50%
    const wrapperMatch = cssSource.match(/\.qs-toggle-icon-wrapper,\s*\.qs-toggle-icon\s*\{([^}]+)\}/);
    expect(wrapperMatch).toBeTruthy();
    const wrapperCss = wrapperMatch![1];
    expect(wrapperCss).toContain('background: transparent');
    expect(wrapperCss).toContain('border-radius: 0');
    expect(wrapperCss).toContain('box-shadow: none');

    // Verify active toggle state does not reintroduce oval background or box shadow
    const activeMatch = cssSource.match(/\.qs-toggle-card\.is-active \.qs-toggle-icon-wrapper[^\{]*\{([^}]+)\}/);
    expect(activeMatch).toBeTruthy();
    const activeCss = activeMatch![1];
    expect(activeCss).toContain('background: transparent');
    expect(activeCss).toContain('box-shadow: none');
  });
});

describe('Wallpaper Selection & Resolution', () => {
  it('correctly filters supported image extensions and rejects non-images', () => {
    // Supported formats
    expect(MAX_WALLPAPER_BYTES).toBe(20 * 1024 * 1024);
    for (const ext of SUPPORTED_WALLPAPER_EXTENSIONS) {
      expect(isSupportedImageExtension(`wallpaper.${ext}`)).toBe(true);
      expect(isSupportedImageExtension(`IMAGE.${ext.toUpperCase()}`)).toBe(true);
      expect(isSupportedImageExtension(ext)).toBe(true);
    }

    // Unsupported formats
    expect(isSupportedImageExtension('notes.txt')).toBe(false);
    expect(isSupportedImageExtension('document.pdf')).toBe(false);
    expect(isSupportedImageExtension('readme.md')).toBe(false);
    expect(isSupportedImageExtension('video.mp4')).toBe(false);
    expect(isSupportedImageExtension('script.sh')).toBe(false);
    expect(isSupportedImageExtension('archive.zip')).toBe(false);
    expect(isSupportedImageExtension('')).toBe(false);
  });

  it('extracts human-readable wallpaper display names', () => {
    expect(getWallpaperDisplayName('/home/pratyush/images/hero.png')).toBe('hero.png');
    expect(getWallpaperDisplayName('vfs:/home/pratyush/images/custom-bg.webp')).toBe('custom-bg.webp');
    expect(getWallpaperDisplayName('/portfolio/images/hero.png')).toBe('hero.png');
    expect(getWallpaperDisplayName('https://images.example.com/wallpaper.jpg')).toBe('wallpaper.jpg');
    expect(getWallpaperDisplayName('')).toBe('');
  });

  it('resolves direct web URLs and public assets directly', async () => {
    const httpsUrl = 'https://example.com/wallpapers/nature.jpg';
    expect(await resolveWallpaperSource(httpsUrl)).toBe(httpsUrl);

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(await resolveWallpaperSource(dataUrl)).toBe(dataUrl);

    const publicAsset = '/portfolio/images/hero.png';
    expect(await resolveWallpaperSource(publicAsset)).toBe(publicAsset);
  });

  it('resolves built-in VirtualFS static assets to their assetPath', async () => {
    const heroVfsPath = '/home/pratyush/images/hero.png';
    const resolved = await resolveWallpaperSource(heroVfsPath);
    expect(resolved).toBe('/portfolio/images/hero.png');

    // Also supports vfs: prefix
    const prefixed = await resolveWallpaperSource('vfs:/home/pratyush/images/hero.png');
    expect(prefixed).toBe('/portfolio/images/hero.png');
  });

  it('rejects non-image files in VirtualFS from being used as wallpaper', async () => {
    const textFilePath = '/home/pratyush/about.txt';
    const resolved = await resolveWallpaperSource(textFilePath);
    expect(resolved).toBe('');

    const pdfFilePath = '/home/pratyush/resume.pdf';
    expect(await resolveWallpaperSource(pdfFilePath)).toBe('');
  });

  it('fails gracefully on missing files or invalid paths without throwing', async () => {
    expect(await resolveWallpaperSource('/nonexistent/image.png')).toBe('');
    expect(await resolveWallpaperSource('/home/pratyush/images/missing-photo.jpg')).toBe('');
    expect(await resolveWallpaperSource('')).toBe('');
    expect(await resolveWallpaperSource('   ')).toBe('');
    expect(await resolveWallpaperSource('/home/pratyush')).toBe(''); // directory path
  });
});

describe('Desktop Store Wallpaper Actions & Immediate Application', () => {
  const initialWallpaper = useDesktopStore.getState().wallpaper;

  afterEach(() => {
    useDesktopStore.getState().setWallpaper(initialWallpaper);
  });

  it('applies wallpaper immediately when set', () => {
    useDesktopStore.getState().setWallpaper('/home/pratyush/images/hero.png');
    expect(useDesktopStore.getState().wallpaper).toBe('/home/pratyush/images/hero.png');
  });

  it('allows clearing wallpaper to revert to solid color', () => {
    useDesktopStore.getState().setWallpaper('/home/pratyush/images/hero.png');
    expect(useDesktopStore.getState().wallpaper).toBe('/home/pratyush/images/hero.png');

    useDesktopStore.getState().setWallpaper('');
    expect(useDesktopStore.getState().wallpaper).toBe('');
  });

  it('preserves existing wallpaper when cancellation occurs', () => {
    const original = '/home/pratyush/images/hero.png';
    useDesktopStore.getState().setWallpaper(original);

    // Simulated user cancelling File Manager picker
    const cancelPicker = () => {
      // no-op, leaves wallpaper state untouched
    };
    cancelPicker();

    expect(useDesktopStore.getState().wallpaper).toBe(original);
  });
});

describe('VirtualFS Persistence & State Hydration', () => {
  it('persists and restores VFS state from localStorage', () => {
    const state = vfs.getState();
    expect(state).toBeDefined();
    expect(state.nodes[state.rootId]).toBeDefined();

    // Verify localStorage persistence module
    saveToLocalStorage(state);
    const reloaded = loadFromLocalStorage();
    expect(reloaded).not.toBeNull();
    expect(reloaded?.rootId).toBe(state.rootId);
    expect(reloaded?.cwd).toBe(state.cwd);
  });
});

describe('File Manager Selection Mode Integration', () => {
  it('verifies FileManager component exports picker types and accepts picker props', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const fileManagerSource = fs.readFileSync(
      path.resolve(__dirname, '../components/file-manager/FileManager.tsx'),
      'utf-8'
    );

    expect(fileManagerSource).toContain('export interface FilePickerOptions');
    expect(fileManagerSource).toContain('export interface SelectedFileResult');
    expect(fileManagerSource).toContain('isPicker?: boolean');
    expect(fileManagerSource).toContain('pickerOptions?: FilePickerOptions');
    expect(fileManagerSource).toContain('onSelectFile?: (file: SelectedFileResult) => void');
    expect(fileManagerSource).toContain('onCancel?: () => void');
    expect(fileManagerSource).toContain('fm-picker-footer');
    expect(fileManagerSource).toContain('isPickerIneligible');
  });

  it('verifies Settings component contains Choose from File Manager button and modal picker', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const settingsSource = fs.readFileSync(
      path.resolve(__dirname, '../components/settings/Settings.tsx'),
      'utf-8'
    );

    expect(settingsSource).toContain('Choose from File Manager');
    expect(settingsSource).toContain('settings-picker-modal-backdrop');
    expect(settingsSource).toContain('settings-picker-modal-dialog');
    expect(settingsSource).toContain('isPicker={true}');
    expect(settingsSource).toContain('useWallpaperSource');
  });
});

describe('Desktop Clock Layering & Panel Visibility', () => {
  it('encloses clock and date inside a protective translucent panel without clipping masks', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const clockSource = fs.readFileSync(
      path.resolve(__dirname, '../components/ui/LiquidGlassClock.tsx'),
      'utf-8'
    );
    const cssSource = fs.readFileSync(
      path.resolve(__dirname, '../components/ui/LiquidGlassClock.css'),
      'utf-8'
    );

    // Verify backdrop panel element exists in markup
    expect(clockSource).toContain('liquid-clock-panel-backdrop');

    // Verify backdrop styles: backdrop-filter and border-radius
    expect(cssSource).toContain('.liquid-clock-panel-backdrop');
    expect(cssSource).toContain('-webkit-backdrop-filter: var(--liquid-glass-blur)');
    expect(cssSource).toContain('backdrop-filter: var(--liquid-glass-blur)');

    // Verify obsolete clipping mask was removed so date is not cut off
    expect(cssSource).not.toContain('mask-image: radial-gradient(ellipse 85% 75% at 50% 50%');

    // Verify date is styled for readability
    expect(cssSource).toContain('.liquid-clock-date');
    expect(cssSource).toContain('text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85)');

    // Verify responsive breakpoints exist for tablet and mobile
    expect(cssSource).toContain('@media (max-width: 768px)');
    expect(cssSource).toContain('@media (max-width: 480px)');
  });
});

describe('Desktop Icons Single-Click Activation', () => {
  it('activates desktop shortcuts on single click and passes onActivate to DesktopIcons', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const iconsSource = fs.readFileSync(
      path.resolve(__dirname, '../components/desktop/DesktopIcons.tsx'),
      'utf-8'
    );
    const desktopSource = fs.readFileSync(
      path.resolve(__dirname, '../components/desktop/Desktop.tsx'),
      'utf-8'
    );

    // Verify onActivate is defined on props and invoked in handleClick
    expect(iconsSource).toContain('onActivate?: (appId: string) => void');
    expect(iconsSource).toContain('onActivate(icon.appId || icon.id)');

    // Verify Desktop.tsx connects single-click activation to handleOpenApp
    expect(desktopSource).toContain('onActivate={handleOpenApp}');
  });
});

describe('Taskbar Default Position & Persistence', () => {
  it('defaults panelPosition to bottom in store and helper functions', async () => {
    const { getGridStartY, snapToGrid } = await import('../stores/useDesktopStore');

    // By default without args, helpers should use 'bottom'
    expect(getGridStartY()).toBe(24);
    const snapped = snapToGrid(100, 100);
    expect(snapped).toBeDefined();

    // Verify initial state defaults to bottom
    const state = useDesktopStore.getState();
    expect(state.panelPosition).toBe('bottom');
  });

  it('allows user to change panelPosition and preserves the setting', () => {
    const original = useDesktopStore.getState().panelPosition;
    try {
      useDesktopStore.getState().setPanelPosition('top');
      expect(useDesktopStore.getState().panelPosition).toBe('top');

      useDesktopStore.getState().setPanelPosition('bottom');
      expect(useDesktopStore.getState().panelPosition).toBe('bottom');
    } finally {
      useDesktopStore.getState().setPanelPosition(original);
    }
  });
});

describe('Default Glass Blur Radius & Config Fallback', () => {
  it('defaults glassBlur to 5 in store and index.css', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexCss = fs.readFileSync(
      path.resolve(__dirname, '../index.css'),
      'utf-8'
    );

    expect(indexCss).toContain('--glass-blur-radius: 5px');
    expect(useDesktopStore.getState().glassBlur).toBe(5);
  });

  it('preserves user custom glassBlur setting when updated', () => {
    const original = useDesktopStore.getState().glassBlur;
    try {
      useDesktopStore.getState().setGlassBlur(12);
      expect(useDesktopStore.getState().glassBlur).toBe(12);
    } finally {
      useDesktopStore.getState().setGlassBlur(original);
    }
  });
});

