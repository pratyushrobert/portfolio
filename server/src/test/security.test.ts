import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../config/env.js';
import { buildApp } from '../app.js';
import { loadTestConfig } from './test-app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { SESSION_COOKIE_NAME } from '../services/auth.js';

describe('security foundations', () => {
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

  it('requires environment-backed credentials and a strong session secret', () => {
    const loadedConfig = loadConfig({
      NODE_ENV: 'test',
      PORT: '3001',
      DATABASE_PATH: ':memory:',
      ADMIN_EMAIL: 'admin@test.local',
      ADMIN_PASSWORD: 'a-long-test-password',
      SESSION_SECRET: 'a-session-secret-that-is-at-least-32-chars',
      CORS_ORIGIN: 'http://localhost:5173',
      UPLOAD_MAX_SIZE: '1048576',
      UPLOAD_DIR: './uploads-test',
    });

    expect(loadedConfig.ADMIN_PASSWORD).toBe('a-long-test-password');
    expect(loadedConfig.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('uses a bcrypt password hash rather than plaintext storage', () => {
    const hash = bcrypt.hashSync('a-long-test-password', 12);
    expect(hash).not.toBe('a-long-test-password');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(bcrypt.compareSync('a-long-test-password', hash)).toBe(true);
    expect(bcrypt.compareSync('wrong-password', hash)).toBe(false);
  });

  it('enforces HTTP security headers via Helmet', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers).toHaveProperty('content-security-policy');
  });

  it('blocks unauthenticated access to admin endpoints with 401', async () => {
    const endpoints = [
      { method: 'GET', url: '/api/admin/dashboard' },
      { method: 'GET', url: '/api/admin/portfolio' },
      { method: 'GET', url: '/api/admin/projects' },
      { method: 'GET', url: '/api/admin/skills' },
      { method: 'GET', url: '/api/admin/experience' },
      { method: 'GET', url: '/api/admin/certificates' },
      { method: 'GET', url: '/api/admin/assets' },
      { method: 'GET', url: '/api/admin/config' },
    ];

    for (const ep of endpoints) {
      const response = await app.inject({
        method: ep.method as 'GET',
        url: ep.url,
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        code: 'UNAUTHENTICATED',
      });
    }
  });

  it('rejects tampered or invalid session cookies and clears the cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=tampered-session-token`,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      code: 'UNAUTHENTICATED',
    });
    // Should clear the invalid cookie
    const setCookie = response.headers['set-cookie'];
    expect(String(setCookie)).toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it('blocks cross-origin mutating requests from unauthorized origins with 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        origin: 'http://malicious-attacker.com',
      },
      payload: {
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      code: 'ORIGIN_FORBIDDEN',
    });
  });

  it('allows mutating requests from authorized origins configured in CORS_ORIGIN', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        origin: 'http://localhost:5173',
      },
      payload: {
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { user: { email: config.ADMIN_EMAIL } },
    });
  });
});
