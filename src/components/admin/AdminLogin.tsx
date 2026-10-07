import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { getApiErrorMessage } from '../../lib/api/client';
import { loginAdmin } from '../../lib/auth/adminAuth';
import './AdminLogin.css';

interface AdminLoginProps {
  windowId: string;
}

export function AdminLogin({ windowId }: AdminLoginProps) {
  const { closeWindow } = useWindowStore();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!email.trim()) {
      setError('Enter email');
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setError('Enter password');
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');
    try {
      await loginAdmin({ email: email.trim(), password });
      closeWindow(windowId);

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
        undefined,
      );
    } catch (loginError) {
      setError(getApiErrorMessage(loginError));
      setPassword('');
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }, [closeWindow, email, password, windowId]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') void handleSubmit();
  }, [handleSubmit]);

  const handleCancel = useCallback(() => {
    closeWindow(windowId);
  }, [closeWindow, windowId]);

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
          <label htmlFor="admin-email">Email</label>
          <input
            ref={emailRef}
            id="admin-email"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            disabled={loading}
            placeholder="admin@example.com"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="admin-login-field">
          <label htmlFor="admin-password">Password</label>
          <input
            ref={passwordRef}
            id="admin-password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={loading}
            placeholder="••••••••••••"
            autoComplete="current-password"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="admin-login-actions">
          <button className="admin-login-btn admin-login-btn-secondary" onClick={handleCancel} disabled={loading}>
            Cancel
          </button>
          <button className="admin-login-btn admin-login-btn-primary" onClick={() => void handleSubmit()} disabled={loading || !email || !password}>
            {loading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </div>
      </div>

      <div className="admin-login-footer">
        <span>Server authentication</span>
        <span>HttpOnly session cookie</span>
      </div>
    </div>
  );
}
