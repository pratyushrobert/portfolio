import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadTestConfig } from './test-app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';

describe('authentication API', () => {
  let app: FastifyInstance;
  let database: ReturnType<typeof initializeDatabase>;
  const config = loadTestConfig();

  beforeAll(async () => {
    database = initializeDatabase(config);
    app = await buildApp({ database, config });
  });

  afterAll(async () => {
    await app.close();
    closeDatabase(database);
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

  it('logs in, exposes the current user, and logs out', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeTruthy();
    expect(String(cookie)).toContain('HttpOnly');

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: String(cookie) } });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.user).toMatchObject({ email: config.ADMIN_EMAIL, role: 'admin' });

    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: String(cookie) } });
    expect(logout.statusCode).toBe(200);
    const afterLogout = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: String(cookie) } });
    expect(afterLogout.statusCode).toBe(401);
  });
});
