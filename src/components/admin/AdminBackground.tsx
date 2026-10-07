import { useState, useEffect, useCallback } from 'react';
import { configApi } from '../../lib/api/config';
import { assetsApi, type PortfolioAsset } from '../../lib/api/assets';
import { useBuiltInAssets } from '../../lib/admin/useAdminConfig';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { getApiErrorMessage } from '../../lib/api/client';
import { Upload, Check, Save, Loader2, RotateCcw } from 'lucide-react';

type BackgroundPosition = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
type BackgroundSize = 'cover' | 'contain' | 'auto' | '100% 100%';

const NEUTRAL_PRESETS = [
  { name: 'Pitch Black', hex: '#000000' },
  { name: 'Deep Graphite', hex: '#0a0c10' },
  { name: 'Dark Charcoal', hex: '#14171f' },
  { name: 'Slate Void', hex: '#0f172a' },
];

function parseOverlayColor(overlay: string): string {
  if (!overlay || overlay === 'none') return '#000000';
  if (overlay.startsWith('#')) return overlay;
  const match = overlay.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
  }
  return '#000000';
}

export function AdminBackground() {
  const { assets } = useBuiltInAssets();
  const setBackgroundConfig = useDesktopStore(state => state.setBackgroundConfig);

  const [imageUrl, setImageUrl] = useState<string>('');
  const [position, setPosition] = useState<BackgroundPosition>('center');
  const [size, setSize] = useState<BackgroundSize>('cover');
  const [overlay, setOverlay] = useState<string>('#000000');
  const [color, setColor] = useState<string>('#08090d');
  const [brightness, setBrightness] = useState<number>(100);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(30);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<PortfolioAsset[]>([]);

  // Load authoritative site-wide background configuration on mount
  const loadConfigData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configData, serverAssets] = await Promise.all([
        configApi.get(),
        assetsApi.listAdmin().catch(() => [] as PortfolioAsset[]),
      ]);

      const activeImage = configData.wallpaper_url ?? '';
      const activePosition = (configData.wallpaper_position as BackgroundPosition) ?? 'center';
      const activeSize = (configData.wallpaper_size as BackgroundSize) ?? 'cover';
      const activeOverlay = configData.wallpaper_overlay ?? 'rgba(0, 0, 0, 0.3)';
      const rawColor = configData.wallpaper_color ?? '#08090d';
      const activeColor = rawColor === '#1a1a2e' ? '#08090d' : rawColor;

      const rawBrightness = configData.wallpaper_brightness ? parseInt(configData.wallpaper_brightness, 10) : 100;
      const rawOverlayOpacity = configData.wallpaper_overlay_opacity ? parseInt(configData.wallpaper_overlay_opacity, 10) : 30;
      const activeBrightness = isNaN(rawBrightness) ? 100 : Math.min(100, Math.max(0, rawBrightness));
      const activeOverlayOpacity = isNaN(rawOverlayOpacity) ? 30 : Math.min(100, Math.max(0, rawOverlayOpacity));

      setImageUrl(activeImage);
      setPosition(activePosition);
      setSize(activeSize);
      setOverlay(activeOverlay);
      setColor(activeColor);
      setBrightness(activeBrightness);
      setOverlayOpacity(activeOverlayOpacity);
      setUploadedAssets(serverAssets.filter(a => a.category === 'image'));

      // Ensure desktop store matches authoritative backend values
      setBackgroundConfig({
        wallpaper: activeImage,
        wallpaperPosition: activePosition,
        wallpaperSize: activeSize,
        wallpaperOverlay: activeOverlay,
        wallpaperColor: activeColor,
        wallpaperBrightness: activeBrightness,
        wallpaperOverlayOpacity: activeOverlayOpacity,
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [setBackgroundConfig]);

  useEffect(() => {
    void loadConfigData();
  }, [loadConfigData]);

  // Immediate preview in current session when modifying any setting
  const handleWallpaperChange = (image: string) => {
    setImageUrl(image);
    setBackgroundConfig({ wallpaper: image });
    setSaveSuccess(null);
  };

  const handlePositionChange = (newPosition: BackgroundPosition) => {
    setPosition(newPosition);
    setBackgroundConfig({ wallpaperPosition: newPosition });
    setSaveSuccess(null);
  };

  const handleSizeChange = (newSize: BackgroundSize) => {
    setSize(newSize);
    setBackgroundConfig({ wallpaperSize: newSize });
    setSaveSuccess(null);
  };

  const handleOverlayChange = (newOverlay: string) => {
    setOverlay(newOverlay);
    setBackgroundConfig({ wallpaperOverlay: newOverlay });
    setSaveSuccess(null);
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setBackgroundConfig({ wallpaperColor: newColor });
    setSaveSuccess(null);
  };

  const handleBrightnessChange = (newBrightness: number) => {
    setBrightness(newBrightness);
    setBackgroundConfig({ wallpaperBrightness: newBrightness });
    setSaveSuccess(null);
  };

  const handleOverlayOpacityChange = (newOpacity: number) => {
    setOverlayOpacity(newOpacity);
    setBackgroundConfig({ wallpaperOverlayOpacity: newOpacity });
    setSaveSuccess(null);
  };

  // Authoritative Save to backend site_config
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      await configApi.saveMany([
        { key: 'wallpaper_url', value: imageUrl, description: 'Desktop wallpaper URL' },
        { key: 'wallpaper_position', value: position, description: 'Wallpaper position' },
        { key: 'wallpaper_size', value: size, description: 'Wallpaper size' },
        { key: 'wallpaper_overlay', value: overlay, description: 'Wallpaper overlay' },
        { key: 'wallpaper_color', value: color, description: 'Wallpaper fallback color' },
        { key: 'wallpaper_brightness', value: String(brightness), description: 'Wallpaper brightness percentage' },
        { key: 'wallpaper_overlay_opacity', value: String(overlayOpacity), description: 'Wallpaper overlay darkness percentage' },
      ]);
      setSaveSuccess('Background and wallpaper configuration saved to database successfully.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Reset to default settings
  const handleResetDefaults = () => {
    setImageUrl('');
    setPosition('center');
    setSize('cover');
    setOverlay('rgba(0, 0, 0, 0.3)');
    setColor('#08090d');
    setBrightness(100);
    setOverlayOpacity(30);
    setBackgroundConfig({
      wallpaper: '',
      wallpaperPosition: 'center',
      wallpaperSize: 'cover',
      wallpaperOverlay: 'rgba(0, 0, 0, 0.3)',
      wallpaperColor: '#08090d',
      wallpaperBrightness: 100,
      wallpaperOverlayOpacity: 30,
    });
    setSaveSuccess('Reset to default values. Click "Save Changes" to persist.');
  };

  // Permanent asset upload via Fastify backend (NEVER temporary blob URLs)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, GIF, AVIF)');
      return;
    }

    setUploading(true);
    setError(null);
    setSaveSuccess(null);

    try {
      // 1. Upload to backend Fastify server which saves file in server/uploads/
      const asset = await assetsApi.upload(file, {
        category: 'image',
        name: file.name,
      });

      // 2. The backend returns stable permanent URL (/uploads/<uuid>.<ext>)
      const permanentUrl = asset.url;

      // 3. Update current UI and live Desktop immediately
      setImageUrl(permanentUrl);
      setBackgroundConfig({ wallpaper: permanentUrl });

      // 4. Save authoritatively into backend site_config table
      await configApi.save({
        key: 'wallpaper_url',
        value: permanentUrl,
        description: 'Desktop wallpaper URL',
      });

      // 5. Update local asset list and notify admin
      setUploadedAssets(prev => [asset, ...prev.filter(a => a.id !== asset.id)]);
      setSaveSuccess(`Uploaded "${file.name}" permanently and saved as active wallpaper.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const builtinImageAssets = assets.filter(a => a.category === 'image');

  if (loading) {
    return (
      <div className="admin-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: '#888' }}>
          <Loader2 className="spinning" size={20} />
          <span>Loading background configuration from server...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Background / Wallpaper</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={handleResetDefaults}
            disabled={saving || uploading}
            title="Reset to defaults"
          >
            <RotateCcw size={16} /> Defaults
          </button>
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />} Save Changes
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="admin-success" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#1a3a2a', border: '1px solid #2e7d32', borderRadius: 6, color: '#81c784', marginBottom: 16 }}>
          <Check size={16} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {error && <div className="admin-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="admin-card">
        <h3>Current Wallpaper Preview</h3>
        <div
          className="admin-wallpaper-preview"
          style={{
            backgroundColor: color,
            position: 'relative',
          }}
        >
          {imageUrl && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("${imageUrl}")`,
                backgroundSize: size,
                backgroundPosition: position,
                backgroundRepeat: 'no-repeat',
                filter: `brightness(${brightness}%)`,
                transition: 'filter 0.15s ease',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: parseOverlayColor(overlay),
              opacity: overlayOpacity / 100,
              pointerEvents: 'none',
              transition: 'opacity 0.15s ease',
            }}
          />
          {imageUrl ? (
            <div className="admin-wallpaper-info">
              <p>Active: {imageUrl} ({brightness}% brightness, {overlayOpacity}% darkness)</p>
              <button
                className="admin-btn admin-btn-secondary"
                style={{ marginTop: 8, fontSize: '0.8rem', padding: '4px 8px' }}
                onClick={() => handleWallpaperChange('')}
              >
                Clear Wallpaper (Use Fallback Color)
              </button>
            </div>
          ) : (
            <div className="admin-wallpaper-info">
              <p>No wallpaper image set (using fallback color: {color})</p>
            </div>
          )}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '16px' }}>
        <h3>Wallpaper Appearance Controls</h3>
        <p className="admin-hint" style={{ marginBottom: 16 }}>
          Configure live brightness and neutral dimming layers applied across desktop and login screens.
        </p>

        <div className="admin-form-grid">
          {/* Brightness Slider */}
          <div className="admin-form-field">
            <div className="admin-range-header">
              <label htmlFor="wallpaper-brightness">Wallpaper Brightness</label>
              <span className="admin-range-value">{brightness}%</span>
            </div>
            <input
              id="wallpaper-brightness"
              type="range"
              min="0"
              max="100"
              value={brightness}
              onChange={e => handleBrightnessChange(Number(e.target.value))}
              className="admin-range-slider"
            />
            <span className="admin-hint">Dim or illuminate the wallpaper graphic (100% is normal).</span>
          </div>

          {/* Overlay Darkness Slider */}
          <div className="admin-form-field">
            <div className="admin-range-header">
              <label htmlFor="wallpaper-darkness">Overlay Darkness / Tint</label>
              <span className="admin-range-value">{overlayOpacity}%</span>
            </div>
            <input
              id="wallpaper-darkness"
              type="range"
              min="0"
              max="100"
              value={overlayOpacity}
              onChange={e => handleOverlayOpacityChange(Number(e.target.value))}
              className="admin-range-slider"
            />
            <span className="admin-hint">Darkness opacity of the neutral veil overlay (0% = transparent, 100% = solid).</span>
          </div>
        </div>

        {/* Neutral Tint Swatches */}
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-h)' }}>
            Overlay Color &amp; Neutral Tints (No Neon / No Purple)
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={overlay.startsWith('#') ? overlay : '#000000'}
              onChange={e => handleOverlayChange(e.target.value)}
              className="admin-color-input"
              title="Pick neutral overlay color"
            />
            <input
              type="text"
              value={overlay}
              onChange={e => handleOverlayChange(e.target.value)}
              placeholder="#000000"
              className="admin-input admin-color-text"
              style={{ flex: 1, marginTop: 0 }}
            />
          </div>
          <div className="admin-neutral-swatches">
            {NEUTRAL_PRESETS.map(preset => (
              <button
                key={preset.hex}
                type="button"
                className={`admin-neutral-swatch ${overlay === preset.hex ? 'active' : ''}`}
                onClick={() => handleOverlayChange(preset.hex)}
              >
                <span className="admin-swatch-dot" style={{ backgroundColor: preset.hex }} />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card-grid" style={{ marginTop: '16px' }}>
        <div className="admin-card">
          <h3>Background Position</h3>
          <select
            value={position}
            onChange={e => handlePositionChange(e.target.value as BackgroundPosition)}
            className="admin-select"
          >
            <option value="center">Center</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="top left">Top Left</option>
            <option value="top right">Top Right</option>
            <option value="bottom left">Bottom Left</option>
            <option value="bottom right">Bottom Right</option>
          </select>
        </div>

        <div className="admin-card">
          <h3>Background Size</h3>
          <select
            value={size}
            onChange={e => handleSizeChange(e.target.value as BackgroundSize)}
            className="admin-select"
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="auto">Auto</option>
            <option value="100% 100%">Stretch (100% 100%)</option>
          </select>
        </div>

        <div className="admin-card">
          <h3>Fallback Color</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={color.startsWith('#') ? color : '#08090d'}
              onChange={e => handleColorChange(e.target.value)}
              className="admin-color-input"
            />
            <input
              type="text"
              value={color}
              onChange={e => handleColorChange(e.target.value)}
              placeholder="#08090d"
              className="admin-input admin-color-text"
              style={{ flex: 1, marginTop: 0 }}
            />
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '16px' }}>
        <h3>Upload New Wallpaper (Permanent Server Storage)</h3>
        <div className="admin-upload-area">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
            onChange={handleFileUpload}
            disabled={uploading || saving}
            id="wallpaper-upload"
            className="admin-file-input"
          />
          <label htmlFor="wallpaper-upload" className="admin-upload-label">
            {uploading ? <Loader2 size={24} className="spinning" /> : <Upload size={24} />}
            <span>{uploading ? 'Uploading to server...' : 'Choose an image file to upload & set'}</span>
          </label>
          <p className="admin-hint">Files are stored securely in backend storage (`server/uploads/`) and recorded in the database.</p>
        </div>
      </div>

      {uploadedAssets.length > 0 && (
        <div className="admin-card" style={{ marginTop: '16px' }}>
          <h3>Uploaded Server Wallpapers</h3>
          <div className="admin-asset-grid">
            {uploadedAssets.map(asset => (
              <div
                key={asset.id}
                className="admin-asset-card"
                style={{ cursor: 'pointer' }}
                onClick={() => handleWallpaperChange(asset.url)}
              >
                <div className="admin-asset-preview">
                  <img src={asset.url} alt={asset.name} loading="lazy" />
                </div>
                <div className="admin-asset-info">
                  <h4>{asset.name}</h4>
                  <div className="admin-asset-meta">
                    <span className="admin-asset-size">{formatSize(asset.size || 0)}</span>
                  </div>
                </div>
                {imageUrl === asset.url && (
                  <div className="admin-asset-badge">
                    <Check size={16} /> Active
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-card" style={{ marginTop: '16px' }}>
        <h3>Built-in Portfolio Images</h3>
        <div className="admin-asset-grid">
          {builtinImageAssets.map(asset => (
            <div
              key={asset.assetPath}
              className="admin-asset-card"
              style={{ cursor: 'pointer' }}
              onClick={() => handleWallpaperChange(asset.assetPath)}
            >
              <div className="admin-asset-preview">
                <img src={asset.assetPath} alt={asset.name} loading="lazy" />
              </div>
              <div className="admin-asset-info">
                <h4>{asset.name}</h4>
                <div className="admin-asset-meta">
                  <span className="admin-asset-size">{formatSize(asset.size || 0)}</span>
                </div>
              </div>
              {imageUrl === asset.assetPath && (
                <div className="admin-asset-badge">
                  <Check size={16} /> Active
                </div>
              )}
            </div>
          ))}
          {builtinImageAssets.length === 0 && (
            <div className="admin-empty-state">
              <span className="admin-empty-icon">🖼️</span>
              <p>No built-in images found.</p>
              <p className="admin-hint">Add images to public/portfolio/images/ and they will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}