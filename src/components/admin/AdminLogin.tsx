import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { authenticateAdmin, setAdminAuthenticated, clearAdminAuth } from '../../lib/auth/adminAuth';
import './AdminLogin.css';

interface AdminLoginProps {
  windowId: string;
}

export function AdminLogin({ windowId }: AdminLoginProps) {
  const { closeWindow } = useWindowStore();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Focus password input on mount
  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!password) {
      setError('Enter password');
      return;
    }

    setLoading(true);
    setError('');

    // Small delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100));

    if (authenticateAdmin(password)) {
      setAdminAuthenticated(true);
      closeWindow(windowId);

      // Open Admin Portal
      const { openWindowWithParams } = useWindowStore.getState();
      const portalWindowId = `admin-portal-${Date.now()}`;
      openWindowWithParams(
        {
          id: portalWindowId,
          appId: 'admin-portal',
          title: 'Admin Portal',
          icon: 'Lock',
          x: 50 + Math.random() * 300,
          y: 50 + Math.random() * 200,
          width: 1000,
          height: 700,
          isMinimized: false,
          isMaximized: false,
        },
        undefined
      );
    } else {
      setError('Access denied.');
      setPassword('');
      setLoading(false);
      passwordRef.current?.focus();
    }
  }, [password, windowId, closeWindow]);

  const handleCancel = useCallback(() => {
    clearAdminAuth();
    closeWindow(windowId);
  }, [windowId, closeWindow]);

  return (
    <div className="admin-login" onKeyDown={handleKeyDown}>
      <div className="admin-login-header">
        <div className="admin-login-title">
          <div className="admin-login-icon">🐱</div>
          <div>
            <h1>MimiOS</h1>
            <span className="admin-login-subtitle">MIMI-SERVANT</span>
          </div>
        </div>
        <div className="admin-login-badge">ADMIN ACCESS</div>
      </div>

      <div className="admin-login-form">
        {error && <div className="admin-login-error">{error}</div>}

        <div className="admin-login-field">
          <label htmlFor="admin-password">Password</label>
          <input
            ref={passwordRef}
            id="admin-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="••••••••••••"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="admin-login-actions">
          <button
            className="admin-login-btn admin-login-btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="admin-login-btn admin-login-btn-primary"
            onClick={handleSubmit}
            disabled={loading || !password}
          >
            {loading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </div>
      </div>

      <div className="admin-login-footer">
        <span>Development access only</span>
        <span>Session-based authentication</span>
      </div>
    </div>
  );
}