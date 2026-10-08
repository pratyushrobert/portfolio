import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { loadTestConfig } from './test-app.js';
import { clearGitHubCache } from '../services/github.js';

const mockReposPage1 = [
  {
    id: 101,
    name: 'SecureVault',
    full_name: 'pratyushrobert/SecureVault',
    private: false,
    fork: false,
    description: 'Zero-knowledge encrypted storage system',
    html_url: 'https://github.com/pratyushrobert/SecureVault',
    default_branch: 'main',
    language: 'TypeScript',
    topics: ['security', 'cryptography'],
    stargazers_count: 42,
    forks_count: 5,
    size: 1024,
    archived: false,
    updated_at: '2026-03-01T10:00:00Z',
    pushed_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 102,
    name: 'PrivateProject',
    full_name: 'pratyushrobert/PrivateProject',
    private: true,
    fork: false,
    description: 'Secret confidential repository',
    html_url: 'https://github.com/pratyushrobert/PrivateProject',
    default_branch: 'main',
    language: 'Python',
    topics: ['private'],
    stargazers_count: 0,
    forks_count: 0,
    size: 200,
    archived: false,
    updated_at: '2026-03-01T10:00:00Z',
    pushed_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 103,
    name: 'ForkedRepo',
    full_name: 'pratyushrobert/ForkedRepo',
    private: false,
    fork: true,
    description: 'A fork of someone elses project',
    html_url: 'https://github.com/pratyushrobert/ForkedRepo',
    default_branch: 'main',
    language: 'JavaScript',
    topics: [],
    stargazers_count: 2,
    forks_count: 0,
    size: 350,
    archived: false,
    updated_at: '2026-03-01T10:00:00Z',
    pushed_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 104,
    name: 'OldArchivedTool',
    full_name: 'pratyushrobert/OldArchivedTool',
    private: false,
    fork: false,
    description: 'Archived legacy security utility',
    html_url: 'https://github.com/pratyushrobert/OldArchivedTool',
    default_branch: 'master',
    language: 'Go',
    topics: ['archive'],
    stargazers_count: 15,
    forks_count: 1,
    size: 800,
    archived: true,
    updated_at: '2024-01-01T10:00:00Z',
    pushed_at: '2024-01-01T12:00:00Z',
  },
];

const mockContents = [
  {
    name: 'README.md',
    path: 'README.md',
    type: 'file',
    size: 512,
    sha: 'sha-readme',
    html_url: 'https://github.com/pratyushrobert/SecureVault/blob/main/README.md',
    download_url: 'https://raw.githubusercontent.com/pratyushrobert/SecureVault/main/README.md',
  },
];

const mockFile = {
  name: 'README.md',
  path: 'README.md',
  type: 'file',
  size: 26,
  sha: 'sha-readme',
  content: Buffer.from('# SecureVault\nReadme text').toString('base64'),
  encoding: 'base64',
  html_url: 'https://github.com/pratyushrobert/SecureVault/blob/main/README.md',
  download_url: 'https://raw.githubusercontent.com/pratyushrobert/SecureVault/main/README.md',
};

describe('GitHub Account Discovery & Remote Browsing', () => {
  let app: FastifyInstance;
  let config = loadTestConfig();
  let db: Awaited<ReturnType<typeof initializeDatabase>>;

  beforeAll(async () => {
    db = await initializeDatabase(config);
    app = await buildApp({ database: db, config });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase(db);
  });

  beforeEach(() => {
    clearGitHubCache();
    vi.restoreAllMocks();
  });

  it('GET /api/github/repos returns public repos belonging to GITHUB_USERNAME and filters private/forks', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/users/pratyushrobert/repos')) {
        return new Response(JSON.stringify(mockReposPage1), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/github/repos',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const names = body.data.map((r: { name: string }) => r.name);
    // Should include public repo and archived repo
    expect(names).toContain('SecureVault');
    expect(names).toContain('OldArchivedTool');
    // Should EXCLUDE private repos and forks
    expect(names).not.toContain('PrivateProject');
    expect(names).not.toContain('ForkedRepo');

    const archivedItem = body.data.find((r: { name: string }) => r.name === 'OldArchivedTool');
    expect(archivedItem.archived).toBe(true);
  });

  it('correctly handles multi-page pagination when discovering repositories', async () => {
    // Generate page 1 with 100 repos, page 2 with 2 repos
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: 1000 + i,
      name: `repo-${i}`,
      full_name: `pratyushrobert/repo-${i}`,
      private: false,
      fork: false,
      description: `Test repo ${i}`,
      html_url: `https://github.com/pratyushrobert/repo-${i}`,
      default_branch: 'main',
      language: 'TypeScript',
      topics: [],
      stargazers_count: 1,
      forks_count: 0,
      size: 100,
      archived: false,
      updated_at: '2026-03-01T10:00:00Z',
      pushed_at: '2026-03-01T10:00:00Z',
    }));

    const page2 = [
      {
        id: 2001,
        name: 'repo-page2-a',
        full_name: 'pratyushrobert/repo-page2-a',
        private: false,
        fork: false,
        description: 'Page 2 repo A',
        html_url: 'https://github.com/pratyushrobert/repo-page2-a',
        default_branch: 'main',
        language: 'Rust',
        topics: [],
        stargazers_count: 5,
        forks_count: 0,
        size: 50,
        archived: false,
        updated_at: '2026-03-01T10:00:00Z',
        pushed_at: '2026-03-01T10:00:00Z',
      },
      {
        id: 2002,
        name: 'repo-page2-b',
        full_name: 'pratyushrobert/repo-page2-b',
        private: false,
        fork: false,
        description: 'Page 2 repo B',
        html_url: 'https://github.com/pratyushrobert/repo-page2-b',
        default_branch: 'main',
        language: 'Go',
        topics: [],
        stargazers_count: 10,
        forks_count: 1,
        size: 60,
        archived: false,
        updated_at: '2026-03-01T10:00:00Z',
        pushed_at: '2026-03-01T10:00:00Z',
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const parsedUrl = new URL(String(input));
      const page = parsedUrl.searchParams.get('page');
      if (page === '1') {
        return new Response(JSON.stringify(page1), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (page === '2') {
        return new Response(JSON.stringify(page2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/github/repos',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(102);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('uses in-memory cache on subsequent requests and honors ?refresh=true', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify([mockReposPage1[0]]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // First call -> fetches from GitHub
    const res1 = await app.inject({ method: 'GET', url: '/api/github/repos' });
    expect(res1.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call -> cached
    const res2 = await app.inject({ method: 'GET', url: '/api/github/repos' });
    expect(res2.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Call with ?refresh=true -> re-fetches
    const res3 = await app.inject({ method: 'GET', url: '/api/github/repos?refresh=true' });
    expect(res3.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('gracefully falls back to cached repositories when GitHub rate limits (403)', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify([mockReposPage1[0]]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' },
      });
    });

    // Populate cache
    const res1 = await app.inject({ method: 'GET', url: '/api/github/repos' });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().data.length).toBe(1);

    // Force refresh which encounters rate limit -> falls back to existing cache
    const res2 = await app.inject({ method: 'GET', url: '/api/github/repos?refresh=true' });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().data.length).toBe(1);
    expect(res2.json().data[0].name).toBe('SecureVault');
  });

  it('returns 403 RATE_LIMITED if rate limited on cold start with no cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' },
      });
    });

    const res = await app.inject({ method: 'GET', url: '/api/github/repos' });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('RATE_LIMITED');
  });

  it('returns 502 NETWORK_ERROR if fetch fails on cold start with no cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('DNS resolution failed'));

    const res = await app.inject({ method: 'GET', url: '/api/github/repos' });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('NETWORK_ERROR');
  });

  it('DOES NOT create any project records when discovering repositories', async () => {
    const beforeRow = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM projects');
    const beforeCount = beforeRow ? Number(beforeRow.count) : 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify(mockReposPage1), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await app.inject({ method: 'GET', url: '/api/github/repos' });
    expect(res.statusCode).toBe(200);

    const afterRow = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM projects');
    const afterCount = afterRow ? Number(afterRow.count) : 0;
    expect(afterCount).toBe(beforeCount);
  });

  it('NEVER exposes GitHub token in API responses even when token is configured', async () => {
    const testToken = 'ghp_secret_token_1234567890abcdef';
    const configWithToken = { ...config, GITHUB_TOKEN: testToken };
    const appWithToken = await buildApp({ database: db, config: configWithToken });
    await appWithToken.ready();

    let capturedHeaders: Record<string, string> | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: unknown, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return new Response(JSON.stringify([mockReposPage1[0]]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await appWithToken.inject({ method: 'GET', url: '/api/github/repos' });
    expect(res.statusCode).toBe(200);

    // Verify token was used in header to GitHub
    const authHeader = (capturedHeaders as Record<string, string>)?.['Authorization'];
    expect(authHeader).toBe(`Bearer ${testToken}`);

    // Verify token was NOT exposed in response payload or headers
    const rawResponse = res.payload;
    expect(rawResponse.includes(testToken)).toBe(false);
    expect(JSON.stringify(res.headers).includes(testToken)).toBe(false);

    await appWithToken.close();
  });

  it('validates repository name parameter strictly and prevents traversal / SSRF', async () => {
    const maliciousPaths = [
      '../other-repo',
      '..%2Fother-repo',
      'owner/repo',
      'repo;drop',
      'repo<script>',
    ];

    for (const badName of maliciousPaths) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/github/repos/${encodeURIComponent(badName)}/contents`,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('GET /api/github/repos/:repo/contents fetches remote directory contents safely', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/repos/pratyushrobert/SecureVault/contents')) {
        return new Response(JSON.stringify(mockContents), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/github/repos/SecureVault/contents',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].name).toBe('README.md');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('GET /api/github/repos/:repo/file fetches single file content safely', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/repos/pratyushrobert/SecureVault/contents/README.md')) {
        return new Response(JSON.stringify(mockFile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/github/repos/SecureVault/file?path=README.md',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('README.md');
    expect(body.data.content).toBe('# SecureVault\nReadme text');
    expect(fetchSpy).toHaveBeenCalled();
  });
});
