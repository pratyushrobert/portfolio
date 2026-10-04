import { useState } from 'react';
import { useAdminConfig } from '../../lib/admin/useAdminConfig';
import { isAdminAuthenticated, clearAdminAuth } from '../../lib/auth/adminAuth';
import { useWindowStore } from '../../stores/useWindowStore';
import { Trash2, Loader2, AlertCircle } from 'lucide-react';

export function AdminSystem({ windowId }: { windowId: string }) {
  const { closeWindow } = useWindowStore();
  const { config, updateConfig, reset } = useAdminConfig();
  const [resetting, setResetting] = useState(false);

  const handleLogout = () => {
    clearAdminAuth();
    closeWindow(windowId);
  };

  const handleReset = async () => {
    if (!confirm('Reset all admin configuration to defaults? This will not affect visitor files or built-in assets.')) return;

    setResetting(true);
    try {
      reset();
      alert('Configuration reset to defaults');
    } catch (err) {
      console.error('Reset failed:', err);
      alert('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  };

  const state = isAdminAuthenticated() ? 'authenticated' : 'unauthenticated';

  return (
    <div className="admin-section">
      <h2>System</h2>

      <div className="admin-card-grid">
        <div className="admin-card">
          <h3>Authentication Status</h3>
          <p className={state === 'authenticated' ? 'status-ok' : 'status-error'}>
            {state === 'authenticated' ? 'Authenticated (session)' : 'Not authenticated'}
          </p>
          <p className="admin-card-meta">Session-based authentication</p>
          <p className="admin-card-meta">Password: mimiisbest@1@ (dev only)</p>
        </div>

        <div className="admin-card">
          <h3>Configuration</h3>
          <p>Local development configuration</p>
          <div className="admin-card-meta">v{config.settings.configVersion}</div>
          <div className="admin-card-meta">Last modified: {config.settings.lastModified}</div>
        </div>

        <div className="admin-card">
          <h3>Storage</h3>
          <p>localStorage (admin config)</p>
          <p>IndexedDB (visitor files - separate)</p>
          <p>SessionStorage (auth flag)</p>
        </div>

        <div className="admin-card">
          <h3>Built-in Assets</h3>
          <p>Images: {config.assets.filter(a => a.category === 'image').length}</p>
          <p>Videos: {config.assets.filter(a => a.category === 'video').length}</p>
          <p>Documents: {config.assets.filter(a => a.category === 'document').length}</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '24px' }}>
        <h3>Actions</h3>
        <div className="admin-actions-row">
          <button className="admin-btn admin-btn-secondary" onClick={handleLogout}>
            Logout
          </button>
          <button
            className="admin-btn admin-btn-danger"
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? <Loader2 size={16} /> : <Trash2 size={16} />} Reset Config
          </button>
        </div>
        <p className="admin-hint" style={{ marginTop: '12px' }}>
          Reset only affects admin configuration in localStorage.
          It does NOT delete visitor files, IndexedDB data, or built-in assets in public/portfolio/
        </p>
      </div>

      {state !== 'authenticated' && (
        <div className="admin-card" style={{ marginTop: '16px', borderColor: 'var(--error-border)', background: 'var(--error-bg)' }}>
          <h3 style={{ color: 'var(--error)' }}>
            <AlertCircle size={20} /> Not Authenticated
          </h3>
          <p style={{ color: 'var(--error)' }}>
            Admin session has expired or is invalid.
            Please log in again using <code>access mimi-servant</code> in the terminal.
          </p>
        </div>
      )}
    </div>
  );
}