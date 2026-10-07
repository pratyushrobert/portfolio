import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { loadTestConfig } from './test-app.js';
import { clearGitHubCache } from '../services/github.js';

const mockRootTree = [
  {
    name: 'src',
    path: 'src',
    sha: 'sha-src-123',
    size: 0,
    url: 'https://api.github.com/repos/pratyushrobert/SecureVault/contents/src',
    html_url: 'https://github.com/pratyushrobert/SecureVault/tree/main/src',
    git_url: 'https://api.github.com/repos/pratyushrobert/SecureVault/git/trees/sha-src-123',
    download_url: null,
    type: 'dir',
  },
  {
    name: 'package.json',
    path: 'package.json',
    sha: 'sha-pkg-456',
    size: 420,
    url: 'https://api.github.com/repos/pratyushrobert/SecureVault/contents/package.json',
    html_url: 'https://github.com/pratyushrobert/SecureVault/blob/main/package.json',
    git_url: 'https://api.github.com/repos/pratyushrobert/SecureVault/git/blobs/sha-pkg-456',
    download_url: 'https://raw.githubusercontent.com/pratyushrobert/SecureVault/main/package.json',
    type: 'file',
  },
  {
    name: 'README.md',
    path: 'README.md',
    sha: 'sha-readme-789',
    size: 850,
    url: 'https://api.github.com/repos/pratyushrobert/SecureVault/contents/README.md',
    html_url: 'https://github.com/pratyushrobert/SecureVault/blob/main/README.md',
    git_url: 'https://api.github.com/repos/pratyushrobert/SecureVault/git/blobs/sha-readme-789',
    download_url: 'https://raw.githubusercontent.com/pratyushrobert/SecureVault/main/README.md',
    type: 'file',
  },
];

const mockSrcTree = [
  {
    name: 'components',
    path: 'src/components',
    sha: 'sha-comp-111',
    size: 0,
    url: 'https://api.github.com/repos/pratyushrobert/SecureVault/contents/src/components',
    html_url: 'https://github.com/pratyushrobert/SecureVault/tree/main/src/components',
    download_url: null,
    type: 'dir',
  },
  {
    name: 'index.ts',
    path: 'src/index.ts',
    sha: 'sha-idx-222',
    size: 512,
    url: 'https://api.github.com/repos/pratyushrobert/SecureVault/contents/src/index.ts',
    html_url: 'https://github.com/pratyushrobert/SecureVault/blob/main/src/index.ts',
    download_url: 'https://raw.githubusercontent.com/pratyushrobert/SecureVault/main/src/index.ts',
    type: 'file',
  },
];

const mockReadmeFile = {
  name: 'README.md',
  path: 'README.md',
  sha: 'sha-readme-789',
  size: 34,
  html_url: 'https://github.com/pratyushrobert/SecureVault/blob/main/README.md',
  download_url: 'https://raw.githubusercontent.com/pratyushrobert/SecureVault/main/README.md',
  type: 'file',
  content: Buffer.from('# SecureVault\n\nPassword manager.').toString('base64'),
  encoding: 'base64',
};

describe('GitHub Repository Remote Browsing API', () => {
  let app: FastifyInstance;
  let database: ReturnType<typeof initializeDatabase>;
  let cookie = '';
  const testSecretToken = 'super-secret-token-xyz-777';
  const config = {
    ...loadTestConfig(),
    GITHUB_TOKEN: testSecretToken,
  };

  let projectWithRepoId = '';
  let projectWithoutRepoId = '';

  beforeAll(async () => {
    database = initializeDatabase(config);
    app = await buildApp({ database, config });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    cookie = String(login.headers['set-cookie']);

    // 1. Project with github_repo
    const proj1 = await app.inject({
      method: 'POST',
      url: '/api/admin/projects',
      headers: { cookie },
      payload: {
        name: 'SecureVault',
        description: 'Password manager',
        github_repo: 'pratyushrobert/SecureVault',
        visibility: 'public',
      },
    });
    expect(proj1.statusCode).toBe(201);
    projectWithRepoId = proj1.json().data.id;

    // 2. Project without github_repo
    const proj2 = await app.inject({
      method: 'POST',
      url: '/api/admin/projects',
      headers: { cookie },
      payload: {
        name: 'Local Only Project',
        description: 'No GitHub repository attached',
        visibility: 'public',
      },
    });
    expect(proj2.statusCode).toBe(201);
    projectWithoutRepoId = proj2.json().data.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
    closeDatabase(database);
  });

  beforeEach(() => {
    clearGitHubCache();
    vi.restoreAllMocks();
  });

  it('serves repository information for a public project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.repo).toBe('pratyushrobert/SecureVault');
    expect(body.data.projectName).toBe('SecureVault');
  });

  it('serves public repository root listing on demand', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      expect(url).toContain('api.github.com/repos/pratyushrobert/SecureVault/contents');
      return new Response(JSON.stringify(mockRootTree), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(3);
    // Directories sorted first
    expect(body.data[0].name).toBe('src');
    expect(body.data[0].type).toBe('dir');
    expect(body.data[1].name).toBe('package.json');
    expect(body.data[2].name).toBe('README.md');

    expect(res.body).not.toContain(testSecretToken);
  });

  it('serves public nested directory listing on demand', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      expect(url).toContain('api.github.com/repos/pratyushrobert/SecureVault/contents/src');
      return new Response(JSON.stringify(mockSrcTree), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents?path=src`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('components');
    expect(body.data[1].name).toBe('index.ts');
  });

  it('fetches and decodes a public file on demand without persisting it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      expect(url).toContain('api.github.com/repos/pratyushrobert/SecureVault/contents/README.md');
      return new Response(JSON.stringify(mockReadmeFile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/file?path=README.md`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('README.md');
    expect(body.data.content).toBe('# SecureVault\n\nPassword manager.');
    expect(body.data.encoding).toBe('utf-8');
    expect(body.data.isBinary).toBe(false);

    expect(res.body).not.toContain(testSecretToken);
  });

  it('returns 400 NO_REPOSITORY for projects without github_repo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithoutRepoId}/repository/contents`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('NO_REPOSITORY');
  });

  it('returns 404 for invalid project ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/00000000-0000-0000-0000-000000000000/repository/contents',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NOT_FOUND');
  });

  it('blocks path traversal attempts (..) with 400 INVALID_PATH', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents?path=../secret`,
    });
    expect(res1.statusCode).toBe(400);
    expect(res1.json().code).toBe('INVALID_PATH');

    const res2 = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/file?path=src/../../secret.txt`,
    });
    expect(res2.statusCode).toBe(400);
    expect(res2.json().code).toBe('INVALID_PATH');
  });

  it('blocks encoded traversal attempts (%2e%2e) with 400 INVALID_PATH', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents?path=%2e%2e/etc/passwd`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_PATH');
  });

  it('blocks arbitrary URL injection attempts with 400 INVALID_PATH', async () => {
    const urlsToTest = [
      'https://evil.example.com',
      'http://attacker.com/steal',
      '//evil.example.com',
      'file:///etc/passwd',
      'javascript:alert(1)',
    ];

    for (const evil of urlsToTest) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectWithRepoId}/repository/contents?path=${encodeURIComponent(evil)}`,
      });
      expect(res.statusCode, evil).toBe(400);
      expect(res.json().code).toBe('INVALID_PATH');
    }
  });

  it('handles GitHub 404 for nonexistent files or directories', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/file?path=nonexistent.txt`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NOT_FOUND');
  });

  it('handles GitHub 403 rate limits gracefully without crashing', async () => {
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
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents`,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('RATE_LIMITED');
  });

  it('handles network timeouts gracefully without crashing Fastify', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      throw new Error('ETIMEDOUT to api.github.com');
    }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents`,
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('NETWORK_ERROR');
  });

  it('protects against oversized files exceeding 1 MB with 413 FILE_TOO_LARGE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({
        name: 'huge-archive.bin',
        path: 'huge-archive.bin',
        size: 5 * 1024 * 1024, // 5 MB
        type: 'file',
        html_url: 'https://github.com/pratyushrobert/SecureVault/blob/main/huge-archive.bin',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/file?path=huge-archive.bin`,
    });

    expect(res.statusCode).toBe(413);
    expect(res.json().code).toBe('FILE_TOO_LARGE');
  });

  it('rejects invalid repository paths containing null bytes or forbidden characters with 400 INVALID_PATH', async () => {
    const invalidPaths = [
      'test%00file.txt',
      'src/<script>',
      'docs/file|name.md',
      'folder/path:colon',
      'folder/path*star',
    ];

    for (const invalid of invalidPaths) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectWithRepoId}/repository/file?path=${invalid}`,
      });
      expect(res.statusCode, invalid).toBe(400);
      expect(res.json().code).toBe('INVALID_PATH');
    }
  });

  it('ensures arbitrary GitHub URLs or repositories cannot be proxied by clients', async () => {
    // Attempting to pass arbitrary owner/repo or full github URL as path
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents?path=https://api.github.com/repos/evilcorp/secret`,
    });
    expect(res1.statusCode).toBe(400);
    expect(res1.json().code).toBe('INVALID_PATH');

    // Attempting to access non-existent project to proxy arbitrary repo
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/projects/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d/repository/contents?path=src',
    });
    expect(res2.statusCode).toBe(404);

    // Verify there is no open proxy endpoint taking arbitrary repo
    const res3 = await app.inject({
      method: 'GET',
      url: '/api/github/proxy?url=https://api.github.com/repos/other/repo',
    });
    expect(res3.statusCode).toBe(404);
  });

  it('ensures GitHub token is never returned or leaked in responses or error payloads', async () => {
    // 1. Success listing
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(mockRootTree), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
    const resSuccess = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents`,
    });
    expect(resSuccess.body).not.toContain(testSecretToken);

    // 2. Error response
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
    const resErr = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository/contents`,
    });
    expect(resErr.body).not.toContain(testSecretToken);

    // 3. Repository info
    const resInfo = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectWithRepoId}/repository`,
    });
    expect(resInfo.body).not.toContain(testSecretToken);
  });
});
