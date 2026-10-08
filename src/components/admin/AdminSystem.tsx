import { useAdminAuth, logoutAdmin } from '../../lib/auth/adminAuth';
import { useWindowStore } from '../../stores/useWindowStore';
import { AlertCircle, LogOut } from 'lucide-react';

export function AdminSystem({ windowId }: { windowId: string }) {
  const { closeWindow } = useWindowStore();
  const { status, user } = useAdminAuth();

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      closeWindow(windowId);
    }
  };

  const isAuth = status === 'authenticated';

  return (
    <div className="admin-section">
      <h2>System & Architecture</h2>

      <div className="admin-card-grid">
        <div className="admin-card">
          <h3>Authentication Status</h3>
          <p className={isAuth ? 'status-ok' : 'status-error'}>
            {isAuth ? 'Authenticated (Server Session)' : 'Not authenticated'}
          </p>
          <div className="admin-card-meta">User: {user?.email || 'N/A'}</div>
          <div className="admin-card-meta">Role: {user?.role || 'N/A'}</div>
          <div className="admin-card-meta">Session: HttpOnly signed cookie (`mimios_session`)</div>
        </div>

        <div className="admin-card">
          <h3>Backend Architecture</h3>
          <p className="status-ok">Fastify 5 + PostgreSQL (Supabase)</p>
          <div className="admin-card-meta">Database: Supabase PostgreSQL Managed Pool</div>
          <div className="admin-card-meta">API Prefix: /api/admin/*</div>
          <div className="admin-card-meta">Validation: Zod schemas on all endpoints</div>
        </div>

        <div className="admin-card">
          <h3>Storage Layers</h3>
          <p>Authoritative Data: PostgreSQL (Supabase)</p>
          <div className="admin-card-meta">Projects, Skills, Experience, Certificates: Backend DB</div>
          <div className="admin-card-meta">Visitor OS Files: Browser IndexedDB (VirtualFS)</div>
          <div className="admin-card-meta">UI Appearance: Local preferences</div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '24px' }}>
        <h3>Session Management</h3>
        <div className="admin-actions-row">
          <button className="admin-btn admin-btn-danger" onClick={() => void handleLogout()}>
            <LogOut size={16} /> Logout Admin Session
          </button>
        </div>
        <p className="admin-hint" style={{ marginTop: '12px' }}>
          Logging out clears the server-side PostgreSQL session and unsets the signed session cookie.
        </p>
      </div>

      {!isAuth && (
        <div className="admin-card" style={{ marginTop: '16px', borderColor: 'var(--error-border)', background: 'var(--error-bg)' }}>
          <h3 style={{ color: 'var(--error)' }}>
            <AlertCircle size={20} /> Not Authenticated
          </h3>
          <p style={{ color: 'var(--error)' }}>
            Admin session has expired or is invalid.
            Please log in again via the terminal or Desktop.
          </p>
        </div>
      )}
    </div>
  );
}
