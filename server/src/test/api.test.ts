import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { loadTestConfig } from './test-app.js';

function multipart(fields: Record<string, string>, filename: string, contentType: string, content: Buffer): { body: Buffer; contentType: string } {
  const boundary = '----mimios-test-boundary';
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  parts.push(Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    content,
    Buffer.from('\r\n'),
  ]));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('portfolio API', () => {
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof initializeDatabase>>;
  let cookie = '';
  const config = loadTestConfig();

  beforeAll(async () => {
    database = await initializeDatabase(config);
    app = await buildApp({ database, config });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD } });
    cookie = String(login.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase(database);
    await rm(resolve(config.UPLOAD_DIR), { recursive: true, force: true });
  });

  it('serves public collections without authentication', async () => {
    for (const path of ['/api/portfolio', '/api/projects', '/api/skills', '/api/experience', '/api/certificates', '/api/assets', '/api/config']) {
      const response = await app.inject({ method: 'GET', url: path });
      expect(response.statusCode, path).toBe(200);
      expect(response.json().success).toBe(true);
    }
  });

  it('protects admin mutations and performs project CRUD', async () => {
    const unauthenticated = await app.inject({ method: 'POST', url: '/api/admin/projects', payload: { name: 'Blocked' } });
    expect(unauthenticated.statusCode).toBe(401);

    const invalid = await app.inject({ method: 'POST', url: '/api/admin/projects', headers: { cookie }, payload: { name: 'x', unknown: true } });
    expect(invalid.statusCode).toBe(400);

    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/projects',
      headers: { cookie },
      payload: { name: 'Recovery Project', description: 'A server-backed project', technologies: ['TypeScript'] },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id as string;

    const publicList = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(publicList.json().data).toHaveLength(1);

    const updated = await app.inject({ method: 'PATCH', url: `/api/admin/projects/${id}`, headers: { cookie }, payload: { featured: true } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.featured).toBe(true);

    const deleted = await app.inject({ method: 'DELETE', url: `/api/admin/projects/${id}`, headers: { cookie } });
    expect(deleted.statusCode).toBe(200);
  });

  it('validates dates and malformed route IDs', async () => {
    const invalidDate = await app.inject({
      method: 'POST',
      url: '/api/admin/experience',
      headers: { cookie },
      payload: { organization: 'Example', role: 'Engineer', start_date: '2024-02-31' },
    });
    expect(invalidDate.statusCode).toBe(400);

    const invalidId = await app.inject({ method: 'DELETE', url: '/api/admin/projects/not-an-id', headers: { cookie } });
    expect(invalidId.statusCode).toBe(400);
  });

  it('accepts a safe asset upload and rejects path traversal filenames', async () => {
    const valid = multipart({ category: 'image', name: 'pixel', tags: '["demo"]' }, 'pixel.png', 'image/png', tinyPng);
    const uploaded = await app.inject({ method: 'POST', url: '/api/admin/assets', headers: { cookie, 'content-type': valid.contentType }, payload: valid.body });
    expect(uploaded.statusCode).toBe(201);
    expect(uploaded.json().data.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);

    const wrongMime = multipart({ category: 'image' }, 'pixel.png', 'application/pdf', tinyPng);
    const wrongMimeResponse = await app.inject({ method: 'POST', url: '/api/admin/assets', headers: { cookie, 'content-type': wrongMime.contentType }, payload: wrongMime.body });
    expect(wrongMimeResponse.statusCode).toBe(400);

    const traversal = multipart({ category: 'image', name: '../outside.png' }, 'pixel.png', 'image/png', tinyPng);
    const rejected = await app.inject({ method: 'POST', url: '/api/admin/assets', headers: { cookie, 'content-type': traversal.contentType }, payload: traversal.body });
    expect(rejected.statusCode).toBe(400);
  });
});
