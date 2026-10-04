import { useState } from 'react';
import { useBuiltInAssets } from '../../lib/admin/useAdminConfig';
import { vfs } from '../../lib/vfs';
import { isFileNode, isDirectoryNode } from '../../lib/vfs/nodes';
import { Trash2, Eye, Download, FileText } from 'lucide-react';

type Category = 'all' | 'image' | 'video' | 'document';

interface BuiltinAsset {
  id: string;
  name: string;
  path: string;
  assetPath: string;
  mimeType: string;
  size: number;
  category: 'image' | 'video' | 'document';
}

export function AdminPortfolioFiles() {
  const { assets, refresh } = useBuiltInAssets();
  const [category, setCategory] = useState<Category>('all');
  const [selectedAsset, setSelectedAsset] = useState<BuiltinAsset | null>(null);

  const filteredAssets = assets.filter(a =>
    category === 'all' || a.category === category
  );

  const handleDelete = async (asset: BuiltinAsset) => {
    if (!confirm(`Delete "${asset.name}" from built-in portfolio? This removes the VFS node but the actual file in public/portfolio/ must be deleted separately.`)) {
      return;
    }

    // Find the node in VFS and remove it
    const state = vfs.getState();
    const nodeEntry = Object.entries(state.nodes).find(
      ([, node]) => isFileNode(node) && node.assetPath === asset.assetPath
    );

    if (nodeEntry) {
      const [nodeId, node] = nodeEntry;
      if (node.parentId) {
        const parent = state.nodes[node.parentId];
        if (parent && isDirectoryNode(parent)) {
          parent.children = parent.children.filter(id => id !== nodeId);
        }
      }
      delete state.nodes[nodeId];
      // Trigger reactivity
      vfs.getState().nodes = { ...vfs.getState().nodes };
      refresh();
    }
  };

  const handleView = (asset: BuiltinAsset) => {
    setSelectedAsset(asset);
  };

  const handleDownload = (asset: BuiltinAsset) => {
    const link = document.createElement('a');
    link.href = asset.assetPath;
    link.download = asset.name;
    link.click();
  };

  if (selectedAsset) {
    return (
      <div className="admin-modal-overlay" onClick={() => setSelectedAsset(null)}>
        <div className="admin-modal" onClick={e => e.stopPropagation()}>
          <div className="admin-modal-header">
            <h3>{selectedAsset.name}</h3>
            <button className="admin-modal-close" onClick={() => setSelectedAsset(null)}>
              <span>&times;</span>
            </button>
          </div>
          <div className="admin-modal-body">
            <div className="admin-modal-preview">
              {selectedAsset.category === 'image' && (
                <img src={selectedAsset.assetPath} alt={selectedAsset.name} />
              )}
              {selectedAsset.category === 'video' && (
                <video src={selectedAsset.assetPath} controls />
              )}
              {selectedAsset.category === 'document' && (
                <iframe src={selectedAsset.assetPath} title={selectedAsset.name} />
              )}
            </div>
            <div className="admin-modal-info">
              <p><strong>Path:</strong> {selectedAsset.path}</p>
              <p><strong>Asset Path:</strong> {selectedAsset.assetPath}</p>
              <p><strong>MIME Type:</strong> {selectedAsset.mimeType}</p>
              <p><strong>Size:</strong> {formatSize(selectedAsset.size)}</p>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-secondary" onClick={handleDownload}>
                <Download size={16} /> Download
              </button>
              <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(selectedAsset!)}>
                <Trash2 size={16} /> Delete from VFS
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Portfolio Files</h2>
        <div className="admin-filter-tabs">
          {(['all', 'image', 'video', 'document'] as Category[]).map(cat => (
            <button
              key={cat}
              className={`admin-tab ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">📁</span>
          <p>No portfolio assets found in this category.</p>
          <p className="admin-hint">Add files to public/portfolio/ and they will appear here after refresh.</p>
        </div>
      ) : (
        <div className="admin-asset-grid">
          {filteredAssets.map(asset => (
            <div key={asset.id} className="admin-asset-card">
              <div className="admin-asset-preview">
                {asset.category === 'image' && (
                  <img src={asset.assetPath} alt={asset.name} loading="lazy" />
                )}
                {asset.category === 'video' && (
                  <video src={asset.assetPath} muted playsInline />
                )}
                {asset.category === 'document' && (
                  <div className="admin-doc-icon">
                    <FileText size={32} />
                  </div>
                )}
              </div>
              <div className="admin-asset-info">
                <h4 title={asset.name}>{asset.name}</h4>
                <div className="admin-asset-meta">
                  <span className="admin-asset-category">{asset.category}</span>
                  <span className="admin-asset-size">{formatSize(asset.size)}</span>
                </div>
              </div>
              <div className="admin-asset-actions">
                <button className="admin-icon-btn" onClick={() => handleView(asset)} title="Preview">
                  <Eye size={16} />
                </button>
                <button className="admin-icon-btn" onClick={() => handleDownload(asset)} title="Download">
                  <Download size={16} />
                </button>
                <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => handleDelete(asset)} title="Delete from VFS">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}