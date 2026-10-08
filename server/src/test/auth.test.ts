import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadTestConfig } from './test-app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { SESSION_COOKIE_NAME } from '../services/auth.js';

describe('authentication API', () => {
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof initializeDatabase>>;
  const config = loadTestConfig();

  beforeAll(async () => {
    database = await initializeDatabase(config);
    app = await buildApp({ database, config });
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase(database);
  });

  it('rejects invalid credentials without creating a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: 'incorrect-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ success: false, code: 'INVALID_CREDENTIALS' });
  });

  it('logs in, exposes the current user, and logs out (single session)', async () => {
    // 9. Normal single-session logout still works without affecting other sessions
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const cookieA = String(loginA.headers['set-cookie']);

    const loginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const cookieB = String(loginB.headers['set-cookie']);

    expect(cookieA).not.toBe(cookieB);

    // Logout session A only
    const logoutA = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookieA } });
    expect(logoutA.statusCode).toBe(200);

    // Session A is gone
    const meA = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieA } });
    expect(meA.statusCode).toBe(401);

    // Session B is still valid
    const meB = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieB } });
    expect(meB.statusCode).toBe(200);
    expect(meB.json().data.user.email).toBe(config.ADMIN_EMAIL);

    // Cleanup session B
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookieB } });
  });

  it('rejects non-admin calling /api/admin/sessions/logout-all', async () => {
    // 2. Non-admin cannot call logout-all
    // Case a: No cookie
    const noCookie = await app.inject({
      method: 'POST',
      url: '/api/admin/sessions/logout-all',
    });
    expect(noCookie.statusCode).toBe(401);
    expect(noCookie.json()).toMatchObject({ success: false, code: 'UNAUTHENTICATED' });

    // Case b: Invalid cookie signature / tampered cookie
    const invalidCookie = await app.inject({
      method: 'POST',
      url: '/api/admin/sessions/logout-all',
      headers: { cookie: `${SESSION_COOKIE_NAME}=bad-unsigned-session-value` },
    });
    expect(invalidCookie.statusCode).toBe(401);
    expect(invalidCookie.json()).toMatchObject({ success: false, code: 'UNAUTHENTICATED' });
  });

  it('invalidates ALL active admin sessions across devices on logout-all', async () => {
    // 3. Multiple active admin sessions are created (simulating 3 distinct devices/browsers)
    const login1 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const cookie1 = String(login1.headers['set-cookie']);

    const login2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const cookie2 = String(login2.headers['set-cookie']);

    const login3 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const cookie3 = String(login3.headers['set-cookie']);

    // Verify all 3 sessions are active and authenticated
    const me1Before = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookie1 } });
    expect(me1Before.statusCode).toBe(200);

    const me2Before = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookie2 } });
    expect(me2Before.statusCode).toBe(200);

    const me3Before = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookie3 } });
    expect(me3Before.statusCode).toBe(200);

    // 1. Admin can call logout-all
    // 4. Logout-all invalidates every active session
    // 7. Current session is also invalidated
    const logoutAllRes = await app.inject({
      method: 'POST',
      url: '/api/admin/sessions/logout-all',
      headers: { cookie: cookie1 },
    });

    expect(logoutAllRes.statusCode).toBe(200);
    const body = logoutAllRes.json();
    expect(body.success).toBe(true);
    expect(body.data.invalidated_sessions).toBeGreaterThanOrEqual(3);

    // 7. Check current session cookie was cleared in response header
    const clearCookieHeader = String(logoutAllRes.headers['set-cookie']);
    expect(clearCookieHeader).toContain(SESSION_COOKIE_NAME);
    expect(clearCookieHeader).toMatch(/(Expires=Thu, 01 Jan 1970|Max-Age=0)/i);

    // 5. Each previously valid session receives 401 on /api/auth/me after invalidation
    const me1After = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookie1 } });
    expect(me1After.statusCode).toBe(401);

    const me2After = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookie2 } });
    expect(me2After.statusCode).toBe(401);

    const me3After = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookie3 } });
    expect(me3After.statusCode).toBe(401);

    // 8. Normal login still works afterward
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    expect(relogin.statusCode).toBe(200);
    const newCookie = String(relogin.headers['set-cookie']);
    const meNew = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: newCookie } });
    expect(meNew.statusCode).toBe(200);
    expect(meNew.json().data.user.email).toBe(config.ADMIN_EMAIL);
  });

  it('handles safely when no active sessions or expired sessions exist', async () => {
    // 6. Expired/already-invalid sessions are handled safely
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const cookie = String(login.headers['set-cookie']);

    // Call logout-all
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/admin/sessions/logout-all',
      headers: { cookie },
    });
    expect(res1.statusCode).toBe(200);

    // Calling again with the same (now revoked) session receives 401
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/admin/sessions/logout-all',
      headers: { cookie },
    });
    expect(res2.statusCode).toBe(401);
  });

  it('preserves production cookie configuration (SameSite=None, Secure, HttpOnly)', async () => {
    // 10. Production cookie behavior remains unchanged
    const prodConfig = {
      ...config,
      NODE_ENV: 'production' as const,
      COOKIE_SAME_SITE: 'none' as const,
      COOKIE_SECURE: true,
    };
    const prodApp = await buildApp({ database, config: prodConfig });

    try {
      const login = await prodApp.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: prodConfig.ADMIN_EMAIL, password: prodConfig.ADMIN_PASSWORD },
      });
      expect(login.statusCode).toBe(200);
      const loginCookie = String(login.headers['set-cookie']);
      expect(loginCookie).toMatch(/SameSite=None/i);
      expect(loginCookie).toMatch(/Secure/i);
      expect(loginCookie).toMatch(/HttpOnly/i);

      const logoutAll = await prodApp.inject({
        method: 'POST',
        url: '/api/admin/sessions/logout-all',
        headers: { cookie: loginCookie },
      });
      expect(logoutAll.statusCode).toBe(200);
      const logoutCookie = String(logoutAll.headers['set-cookie']);
      expect(logoutCookie).toMatch(/SameSite=None/i);
      expect(logoutCookie).toMatch(/Secure/i);
      expect(logoutCookie).toMatch(/HttpOnly/i);
    } finally {
      await prodApp.close();
    }
  });
});
