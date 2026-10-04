import { useAdminConfig, useBuiltInAssets } from '../../lib/admin/useAdminConfig';
import { vfs } from '../../lib/vfs';
import { isFileNode, isDirectoryNode } from '../../lib/vfs/nodes';

export function AdminDashboard() {
  const { config } = useAdminConfig();
  const { assets } = useBuiltInAssets();

  // Count built-in assets by category
  const imageCount = assets.filter(a => a.category === 'image').length;
  const videoCount = assets.filter(a => a.category === 'video').length;
  const docCount = assets.filter(a => a.category === 'document').length;

  // Count projects
  const projectCount = config.projects.filter(p => p.visibility === 'public').length;

  // Count VFS directories/files for stats
  const state = vfs.getState();
  let totalVfsFiles = 0;
  let totalVfsDirs = 0;
  Object.values(state.nodes).forEach(node => {
    if (isFileNode(node)) totalVfsFiles++;
    else if (isDirectoryNode(node)) totalVfsDirs++;
  });

  return (
    <div className="admin-section">
      <h2>Dashboard</h2>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🖼️</div>
          <div className="admin-stat-value">{imageCount}</div>
          <div className="admin-stat-label">Portfolio Images</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🎬</div>
          <div className="admin-stat-value">{videoCount}</div>
          <div className="admin-stat-label">Portfolio Videos</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">📄</div>
          <div className="admin-stat-value">{docCount}</div>
          <div className="admin-stat-label">Documents</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🚀</div>
          <div className="admin-stat-value">{projectCount}</div>
          <div className="admin-stat-label">Public Projects</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">📁</div>
          <div className="admin-stat-value">{totalVfsFiles}</div>
          <div className="admin-stat-label">Total VFS Files</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">📂</div>
          <div className="admin-stat-value">{totalVfsDirs}</div>
          <div className="admin-stat-label">VFS Directories</div>
        </div>
      </div>

      <div className="admin-card-grid" style={{ marginTop: '24px' }}>
        <div className="admin-card">
          <h3>Current Wallpaper</h3>
          <p>{config.appearance.background.image || 'Default (color only)'}</p>
          <div className="admin-card-meta">
            Position: {config.appearance.background.position} | Size: {config.appearance.background.size}
          </div>
        </div>

        <div className="admin-card">
          <h3>Authentication</h3>
          <p className="status-ok">Session Active</p>
          <div className="admin-card-meta">Development mode</div>
        </div>

        <div className="admin-card">
          <h3>Configuration</h3>
          <p>Local development config</p>
          <div className="admin-card-meta">v{config.settings.configVersion}</div>
        </div>
      </div>
    </div>
  );
}