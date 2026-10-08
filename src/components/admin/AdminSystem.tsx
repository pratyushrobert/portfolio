import { useState } from 'react';
import { useAdminAuth, logoutAdmin, invalidateAdminAuth } from '../../lib/auth/adminAuth';
import { adminApi } from '../../lib/api/admin';
import { getApiErrorMessage } from '../../lib/api/client';
import { useWindowStore } from '../../stores/useWindowStore';
import { AlertCircle, LogOut, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';

export function AdminSystem({ windowId }: { windowId: string }) {
  const { closeWindow } = useWindowStore();
  const { status, user } = useAdminAuth();

  const [showConfirmLogoutAll, setShowConfirmLogoutAll] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [logoutAllSuccess, setLogoutAllSuccess] = useState<string | null>(null);
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      closeWindow(windowId);
    }
  };

  const handleConfirmLogoutAll = async () => {
    setLoggingOutAll(true);
    setLogoutAllError(null);
    try {
      const res = await adminApi.logoutAllSessions();
      const count = res?.invalidated_sessions ?? 0;
      setLogoutAllSuccess(`Signed out all active admin sessions (${count} session${count === 1 ? '' : 's'} revoked).`);
      // Keep clear success notification visible before returning to guest state
      setTimeout(() => {
        invalidateAdminAuth();
        closeWindow(windowId);
      }, 1400);
    } catch (err) {
      setLogoutAllError(getApiErrorMessage(err));
      setLoggingOutAll(false);
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>Current Admin Session</div>
              <p className="admin-hint" style={{ margin: '4px 0 0 0' }}>
                Sign out of this browser session only.
              </p>
            </div>
            <button className="admin-btn admin-btn-secondary" onClick={() => void handleLogout()}>
              <LogOut size={16} /> Logout Admin Session
            </button>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--error, #e03e3e)' }}>Global Session Revocation</div>
              <p className="admin-hint" style={{ margin: '4px 0 0 0' }}>
                Sign out every active admin session across all devices.
              </p>
            </div>
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => {
                setLogoutAllError(null);
                setLogoutAllSuccess(null);
                setShowConfirmLogoutAll(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <ShieldAlert size={16} /> Log Out All Admin Sessions
            </button>
          </div>
        </div>
      </div>

      {showConfirmLogoutAll && (
        <div className="admin-modal-overlay" onClick={() => !loggingOutAll && !logoutAllSuccess && setShowConfirmLogoutAll(false)}>
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} style={{ color: 'var(--error, #e03e3e)' }} />
                Log out all admin sessions?
              </h3>
            </div>
            <div className="admin-modal-body">
              {logoutAllSuccess ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(46, 204, 113, 0.15)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: 6, color: '#2ecc71' }}>
                  <CheckCircle2 size={18} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{logoutAllSuccess}</div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Returning to normal guest state...</div>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--text)', lineHeight: 1.5 }}>
                    This will sign out every active admin session across all browsers and devices, including this session.
                  </p>
                  {logoutAllError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 6, color: 'var(--error)', marginTop: 12 }}>
                      <AlertCircle size={16} />
                      <span style={{ fontSize: 13 }}>{logoutAllError}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {!logoutAllSuccess && (
              <div className="admin-modal-footer">
                <button
                  className="admin-btn admin-btn-secondary"
                  disabled={loggingOutAll}
                  onClick={() => setShowConfirmLogoutAll(false)}
                >
                  Cancel
                </button>
                <button
                  className="admin-btn admin-btn-danger"
                  disabled={loggingOutAll}
                  onClick={() => void handleConfirmLogoutAll()}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {loggingOutAll ? (
                    <>
                      <Loader2 size={16} className="spinning" /> Logging Out All...
                    </>
                  ) : (
                    <>
                      <LogOut size={16} /> Log Out All
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
