import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { loadTestConfig } from './test-app.js';

const mockGitHubRepoData = {
  name: 'SecureVault',
  full_name: 'pratyushrobert/SecureVault',
  description: 'An upstream GitHub description that should not overwrite custom portfolio copy',
  html_url: 'https://github.com/pratyushrobert/SecureVault',
  homepage: 'https://securevault.example.com',
  language: 'TypeScript',
  topics: ['security', 'encryption', 'vault'],
  stargazers_count: 128,
  forks_count: 19,
  open_issues_count: 2,
  default_branch: 'main',
  updated_at: '2026-03-01T12:00:00Z',
  pushed_at: '2026-03-02T15:30:00Z',
};

describe('GitHub Project Synchronization API', () => {
  let app: FastifyInstance;
  let database: ReturnType<typeof initializeDatabase>;
  let cookie = '';
  const testSecretToken = 'super-secret-github-token-998877';
  const config = {
    ...loadTestConfig(),
    GITHUB_TOKEN: testSecretToken,
  };

  let createdProjectId = '';

  beforeAll(async () => {
    database = initializeDatabase(config);
    app = await buildApp({ database, config });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    cookie = String(login.headers['set-cookie']);

    // Create an initial project with custom presentation fields
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/projects',
      headers: { cookie },
      payload: {
        name: 'My Custom SecureVault',
        description: 'Custom portfolio description written by Pratyush',
        long_description: 'Custom long markdown text that must remain intact.',
        technologies: ['React', 'TypeScript', 'Node.js'],
        github_url: 'https://github.com/pratyushrobert/SecureVault',
        live_url: 'https://demo.securevault.local',
        visibility: 'public',
        featured: true,
        sort_order: 1,
      },
    });
    expect(createRes.statusCode).toBe(201);
    createdProjectId = createRes.json().data.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
    closeDatabase(database);
  });

  it('rejects unauthenticated sync requests with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${createdProjectId}/github-sync`,
      payload: { github_repo: 'pratyushrobert/SecureVault' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid repository identifiers with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${createdProjectId}/github-sync`,
      headers: { cookie },
      payload: { github_repo: 'invalid repo with spaces' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('INVALID_REPO');
  });

  it('synchronizes GitHub metadata and strictly preserves custom portfolio fields', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return new Response(JSON.stringify(mockGitHubRepoData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${createdProjectId}/github-sync`,
      headers: { cookie },
      payload: { github_repo: 'pratyushrobert/SecureVault' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const project = body.data;

    // GitHub metadata fields updated
    expect(project.github_repo).toBe('pratyushrobert/SecureVault');
    expect(project.github_stars).toBe(128);
    expect(project.github_forks).toBe(19);
    expect(project.github_language).toBe('TypeScript');
    expect(project.github_topics).toEqual(['security', 'encryption', 'vault']);
    expect(project.github_sync_status).toBe('synced');
    expect(typeof project.github_synced_at).toBe('number');
    expect(project.github_synced_at).toBeGreaterThan(0);

    // Custom portfolio presentation fields strictly preserved
    expect(project.name).toBe('My Custom SecureVault');
    expect(project.description).toBe('Custom portfolio description written by Pratyush');
    expect(project.long_description).toBe('Custom long markdown text that must remain intact.');
    expect(project.technologies).toEqual(['React', 'TypeScript', 'Node.js']);
    expect(project.live_url).toBe('https://demo.securevault.local');
    expect(project.visibility).toBe('public');
    expect(project.featured).toBe(true);
    expect(project.sort_order).toBe(1);

    // Ensure authorization header used token when provided
    expect(capturedHeaders).toBeDefined();
    const headersRecord = capturedHeaders as Record<string, string>;
    expect(headersRecord['Authorization']).toBe(`Bearer ${testSecretToken}`);

    // Ensure the token is NEVER leaked in the response payload
    const responseText = res.body;
    expect(responseText).not.toContain(testSecretToken);
  });

  it('serves synchronized GitHub fields on the public project endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${createdProjectId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const project = body.data;

    expect(project.github_repo).toBe('pratyushrobert/SecureVault');
    expect(project.github_stars).toBe(128);
    expect(project.github_forks).toBe(19);
    expect(project.github_language).toBe('TypeScript');
    expect(project.github_topics).toEqual(['security', 'encryption', 'vault']);
    expect(project.name).toBe('My Custom SecureVault');
  });

  it('handles GitHub 404 gracefully and marks sync status as failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${createdProjectId}/github-sync`,
      headers: { cookie },
      payload: { github_repo: 'pratyushrobert/nonexistent-repo-999' },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');

    // Confirm database row records failure
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/admin/projects/${createdProjectId}`,
      headers: { cookie },
    });
    expect(checkRes.json().data.github_sync_status).toBe('failed');
    // Custom name remains intact
    expect(checkRes.json().data.name).toBe('My Custom SecureVault');
  });

  it('handles GitHub 403 rate limits gracefully and marks sync status as failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-remaining': '0',
        },
      });
    }));

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${createdProjectId}/github-sync`,
      headers: { cookie },
      payload: { github_repo: 'pratyushrobert/SecureVault' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('RATE_LIMITED');
  });

  it('handles network timeouts/errors gracefully without crashing server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      throw new Error('connect ETIMEDOUT 140.82.121.4:443');
    }));

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/projects/${createdProjectId}/github-sync`,
      headers: { cookie },
      payload: { github_repo: 'pratyushrobert/SecureVault' },
    });

    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('NETWORK_ERROR');
    expect(body.error).toContain('GitHub API request failed');

    // Verify token is never leaked in the error
    expect(res.body).not.toContain(testSecretToken);
  });
});
