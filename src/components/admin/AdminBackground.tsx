import { useState } from 'react';
import { useAdminConfig, useBuiltInAssets } from '../../lib/admin/useAdminConfig';
import { vfs } from '../../lib/vfs';
import { createBuiltInBinaryFileNode } from '../../lib/vfs/nodes';
import { useDesktopActions } from '../../stores/useDesktopStore';
import { Upload, Check } from 'lucide-react';

type BackgroundPosition = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
type BackgroundSize = 'cover' | 'contain' | 'auto' | '100% 100%';

interface BuiltinAsset {
  assetPath: string;
  name: string;
  size: number;
}

export function AdminBackground() {
  const { config, updateConfig } = useAdminConfig();
  const { assets } = useBuiltInAssets();
  const { setWallpaper } = useDesktopActions();

  const [uploading, setUploading] = useState(false);

  const handleWallpaperChange = (image: string) => {
    updateConfig(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        background: {
          ...prev.appearance.background,
          image,
        },
      },
    }));
    // Also update desktop store for immediate effect
    setWallpaper(image);
  };

  const handlePositionChange = (position: BackgroundPosition) => {
    updateConfig(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        background: {
          ...prev.appearance.background,
          position,
        },
      },
    }));
  };

  const handleSizeChange = (size: BackgroundSize) => {
    updateConfig(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        background: {
          ...prev.appearance.background,
          size,
        },
      },
    }));
  };

  const handleOverlayChange = (overlay: string) => {
    updateConfig(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        background: {
          ...prev.appearance.background,
          overlay,
        },
      },
    }));
  };

  const handleColorChange = (color: string) => {
    updateConfig(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        background: {
          ...prev.appearance.background,
          color,
        },
      },
    }));
  };

  const handleAddWallpaper = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const blobUrl = URL.createObjectURL(file);

      const state = vfs.getState();
      const imagesDir = Object.values(state.nodes).find(
        n => n.name === 'images' && n.type === 'directory'
      );

      if (imagesDir && 'children' in imagesDir) {
        const newFileNode = createBuiltInBinaryFileNode(
          file.name,
          imagesDir.id,
          file.type,
          file.size,
          blobUrl
        );
        vfs.getState().nodes[newFileNode.id] = newFileNode;
        imagesDir.children.push(newFileNode.id);
        vfs.getState().nodes = { ...vfs.getState().nodes };
      }

      handleWallpaperChange(blobUrl);
      alert(`Wallpaper "${file.name}" added. Note: This uses a temporary blob URL. For persistence, the file must be added to public/portfolio/images/ and the VFS updated with the permanent path.`);
    } catch (err) {
      console.error('Failed to add wallpaper:', err);
      alert('Failed to add wallpaper');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAddWallpaper(file);
  };

  const builtinImageAssets = config.appearance.background.image
    ? [{ assetPath: config.appearance.background.image, name: 'Current', size: 0 }, ...assets.filter(a => a.category === 'image')]
    : assets.filter(a => a.category === 'image');

  return (
    <div className="admin-section">
      <h2>Background / Wallpaper</h2>

      <div className="admin-card">
        <h3>Current Wallpaper</h3>
        <div className="admin-wallpaper-preview" style={{
          backgroundImage: config.appearance.background.image ? `url(${config.appearance.background.image})` : 'none',
          backgroundSize: config.appearance.background.size,
          backgroundPosition: config.appearance.background.position,
          backgroundRepeat: 'no-repeat',
          backgroundColor: config.appearance.background.color,
        }}>
          {config.appearance.background.image ? (
            <div className="admin-wallpaper-info">
              <p>Active: {config.appearance.background.image}</p>
            </div>
          ) : (
            <div className="admin-wallpaper-info">
              <p>No wallpaper set (using fallback color)</p>
            </div>
          )}
        </div>
      </div>

      <div className="admin-card-grid" style={{ marginTop: '16px' }}>
        <div className="admin-card">
          <h3>Background Position</h3>
          <select
            value={config.appearance.background.position}
            onChange={e => handlePositionChange(e.target.value as any)}
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
            value={config.appearance.background.size}
            onChange={e => handleSizeChange(e.target.value as any)}
            className="admin-select"
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="auto">Auto</option>
            <option value="100% 100%">Stretch (100% 100%)</option>
          </select>
        </div>

        <div className="admin-card">
          <h3>Overlay Color</h3>
          <input
            type="color"
            value={config.appearance.background.overlay}
            onChange={e => handleOverlayChange(e.target.value)}
            className="admin-color-input"
          />
          <input
            type="text"
            value={config.appearance.background.overlay}
            onChange={e => handleOverlayChange(e.target.value)}
            placeholder="rgba(0,0,0,0.3)"
            className="admin-input admin-color-text"
          />
        </div>

        <div className="admin-card">
          <h3>Fallback Color</h3>
          <input
            type="color"
            value={config.appearance.background.color}
            onChange={e => handleColorChange(e.target.value)}
            className="admin-color-input"
          />
          <input
            type="text"
            value={config.appearance.background.color}
            onChange={e => handleColorChange(e.target.value)}
            placeholder="#1a1a2e"
            className="admin-input admin-color-text"
          />
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '16px' }}>
        <h3>Upload New Wallpaper</h3>
        <div className="admin-upload-area">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            id="wallpaper-upload"
            className="admin-file-input"
          />
          <label htmlFor="wallpaper-upload" className="admin-upload-label">
            <Upload size={24} />
            <span>{uploading ? 'Uploading...' : 'Choose an image file'}</span>
          </label>
          <p className="admin-hint">Supported: PNG, JPG, JPEG, WebP, SVG. For production, files should be added to public/portfolio/images/</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '16px' }}>
        <h3>Built-in Portfolio Images</h3>
        <div className="admin-asset-grid">
          {builtinImageAssets.map(asset => (
            <div key={asset.assetPath} className="admin-asset-card" style={{ cursor: 'pointer' }}>
              <div className="admin-asset-preview" onClick={() => handleWallpaperChange(asset.assetPath)}>
                <img src={asset.assetPath} alt={asset.name} loading="lazy" />
              </div>
              <div className="admin-asset-info">
                <h4>{asset.name}</h4>
                <div className="admin-asset-meta">
                  <span className="admin-asset-size">{formatSize(asset.size || 0)}</span>
                </div>
              </div>
              {config.appearance.background.image === asset.assetPath && (
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