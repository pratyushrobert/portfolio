import { useState, useEffect, useRef } from 'react';
import { assetsApi, type PortfolioAsset } from '../../lib/api/assets';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Upload,
  Trash2,
  Eye,
  Copy,
  Check,
  FileText,
  Video,
  FileCheck,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import './AdminPortfolioFiles.css';
import './AdminPortal.css';

type CategoryFilter = 'all' | 'image' | 'document' | 'video';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminPortfolioFiles() {
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PortfolioAsset | null>(null);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<'image' | 'document' | 'video'>('image');
  const [uploadName, setUploadName] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await assetsApi.listAdmin();
      setAssets(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, ''));
      // Auto-detect category from mime type
      if (file.type.startsWith('image/')) setUploadCategory('image');
      else if (file.type === 'application/pdf') setUploadCategory('document');
      else if (file.type.startsWith('video/')) setUploadCategory('video');
      setUploadError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const tags = uploadTags.split(',').map(t => t.trim()).filter(Boolean);
      const newAsset = await assetsApi.upload(uploadFile, {
        category: uploadCategory,
        name: uploadName.trim() || uploadFile.name,
        tags,
      });

      setAssets(prev => [newAsset, ...prev]);
      // Reset upload form
      setUploadFile(null);
      setUploadName('');
      setUploadTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(getApiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset: PortfolioAsset) => {
    if (!confirm(`Are you sure you want to permanently delete asset "${asset.name}"?`)) {
      return;
    }

    try {
      await assetsApi.remove(asset.id);
      setAssets(prev => prev.filter(a => a.id !== asset.id));
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(null);
      }
    } catch (err) {
      alert(`Failed to delete asset: ${getApiErrorMessage(err)}`);
    }
  };

  const handleCopyUrl = async (asset: PortfolioAsset) => {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // fallback
    }
  };

  const filteredAssets = assets.filter(a => {
    if (categoryFilter === 'all') return true;
    return a.category === categoryFilter;
  });

  return (
    <div className="admin-section" style={{ maxWidth: 900 }}>
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2>Portfolio Assets</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Authoritative media files and documents stored on backend server (uploads directory)
          </span>
        </div>
        <button
          className="admin-btn admin-btn-secondary"
          onClick={() => void loadAssets()}
          disabled={loading || uploading}
          title="Refresh assets from server"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Box */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={16} style={{ color: 'var(--accent)' }} />
          <span>Upload New Asset</span>
        </h3>

        {uploadError && (
          <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', fontSize: 12, marginBottom: 12 }}>
            {uploadError}
          </div>
        )}

        <form onSubmit={handleUpload}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                File (PNG, JPG, WebP, PDF, MP4) *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,video/webm"
                onChange={handleFileChange}
                required
                style={{ fontSize: 12, width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                Category *
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as 'image' | 'document' | 'video')}
                className="admin-input"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                <option value="image">Image (PNG, JPG, WebP)</option>
                <option value="document">Document (PDF)</option>
                <option value="video">Video (MP4, WebM)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                Display Name
              </label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. Project Screenshot or Certificate"
                className="admin-input"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="e.g. portfolio, wallpaper, demo"
                className="admin-input"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={uploading || !uploadFile}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 16px' }}
            >
              {uploading ? <Loader2 size={14} className="spinning" /> : <Upload size={14} />}
              <span>{uploading ? 'Uploading...' : 'Upload Asset'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        <button
          className={`admin-tab ${categoryFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('all')}
        >
          All ({assets.length})
        </button>
        <button
          className={`admin-tab ${categoryFilter === 'image' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('image')}
        >
          Images ({assets.filter(a => a.category === 'image').length})
        </button>
        <button
          className={`admin-tab ${categoryFilter === 'document' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('document')}
        >
          Documents ({assets.filter(a => a.category === 'document').length})
        </button>
        <button
          className={`admin-tab ${categoryFilter === 'video' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('video')}
        >
          Videos ({assets.filter(a => a.category === 'video').length})
        </button>
      </div>

      {/* Asset Cards / Grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
          <Loader2 className="spinning" size={20} />
          <span>Loading assets from database...</span>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="admin-empty-state">
          <FileText size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p>No assets found in this category.</p>
          <p className="admin-hint">Use the upload box above to add images, documents, or videos.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              className="admin-card"
              style={{ display: 'flex', flexDirection: 'column', padding: 12, position: 'relative' }}
            >
              {/* Asset Preview / Thumbnail */}
              <div
                style={{
                  width: '100%',
                  height: 120,
                  borderRadius: 6,
                  background: 'rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginBottom: 10,
                  border: '1px solid var(--border)',
                }}
              >
                {asset.category === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                ) : asset.category === 'document' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                    <FileCheck size={36} />
                    <span style={{ fontSize: 11, opacity: 0.8 }}>PDF Document</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                    <Video size={36} />
                    <span style={{ fontSize: 11, opacity: 0.8 }}>Video</span>
                  </div>
                )}
              </div>

              {/* Asset Info */}
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asset.name}>
                  {asset.name}
                </h4>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  <span className={`admin-badge ${asset.category}`} style={{ fontSize: 9 }}>{asset.category}</span>
                  <span>{formatSize(asset.size)}</span>
                  <span>•</span>
                  <span style={{ fontFamily: 'var(--mono)' }}>{asset.mime_type.split('/')[1]}</span>
                </div>

                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 10 }} title={asset.url}>
                  {asset.url}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="admin-btn admin-btn-secondary"
                    onClick={() => void handleCopyUrl(asset)}
                    style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Copy upload URL to clipboard"
                  >
                    {copiedId === asset.id ? <Check size={12} color="#2ecc71" /> : <Copy size={12} />}
                    <span>{copiedId === asset.id ? 'Copied' : 'Copy URL'}</span>
                  </button>

                  <button
                    className="admin-btn admin-btn-secondary"
                    onClick={() => setSelectedAsset(asset)}
                    style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Preview asset"
                  >
                    <Eye size={12} />
                    <span>View</span>
                  </button>
                </div>

                <button
                  className="admin-icon-btn admin-icon-btn-danger"
                  onClick={() => void handleDelete(asset)}
                  title="Delete asset"
                  style={{ padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Preview Modal */}
      {selectedAsset && (
        <div className="admin-modal-overlay" onClick={() => setSelectedAsset(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '90%' }}>
            <div className="admin-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{selectedAsset.name}</h3>
              <button className="admin-modal-close" onClick={() => setSelectedAsset(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 20 }}>
                &times;
              </button>
            </div>

            <div className="admin-modal-body" style={{ padding: '16px 0' }}>
              <div style={{ width: '100%', maxHeight: 420, overflow: 'auto', background: 'rgba(0,0,0,0.4)', borderRadius: 6, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {selectedAsset.category === 'image' && (
                  <img src={selectedAsset.url} alt={selectedAsset.name} style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }} />
                )}
                {selectedAsset.category === 'document' && (
                  <iframe src={selectedAsset.url} title={selectedAsset.name} style={{ width: '100%', height: 400, border: 'none' }} />
                )}
                {selectedAsset.category === 'video' && (
                  <video src={selectedAsset.url} controls style={{ maxWidth: '100%', maxHeight: 400 }} />
                )}
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                <p style={{ margin: '4px 0' }}><strong>URL:</strong> <span style={{ fontFamily: 'var(--mono)' }}>{selectedAsset.url}</span></p>
                <p style={{ margin: '4px 0' }}><strong>MIME Type:</strong> {selectedAsset.mime_type}</p>
                <p style={{ margin: '4px 0' }}><strong>File Size:</strong> {formatSize(selectedAsset.size)}</p>
              </div>
            </div>

            <div className="admin-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => void handleCopyUrl(selectedAsset)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {copiedId === selectedAsset.id ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                <span>{copiedId === selectedAsset.id ? 'Copied' : 'Copy URL'}</span>
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={() => void handleDelete(selectedAsset)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}