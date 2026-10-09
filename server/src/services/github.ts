export const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
export const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export interface GitHubRepoSummary {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  pushed_at: string;
  size: number;
  archived: boolean;
  fork: boolean;
}

export function validateRepoName(name: string): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new GitHubSyncError('Invalid repository name', 'INVALID_REPO', 400);
  }
  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed) || trimmed === '.' || trimmed === '..') {
    throw new GitHubSyncError('Invalid repository name', 'INVALID_REPO', 400);
  }
  return trimmed;
}

export interface GitHubRepoMetadata {
  repo: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  open_issues: number;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubRepoItem {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
  size: number;
  sha: string;
  html_url: string;
  download_url: string | null;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  size: number;
  sha: string;
  html_url: string;
  download_url: string | null;
  encoding: 'utf-8' | 'base64' | 'binary';
  content: string;
  isBinary: boolean;
  isOversized: boolean;
}

export type GitHubErrorCode =
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_REPO'
  | 'INVALID_PATH'
  | 'FILE_TOO_LARGE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'GITHUB_API_ERROR';

export class GitHubSyncError extends Error {
  constructor(
    message: string,
    public readonly code: GitHubErrorCode,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'GitHubSyncError';
  }
}

export function parseGitHubRepo(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Check if direct owner/repo format
  if (GITHUB_REPO_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Check if GitHub URL
  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() === 'github.com' || url.hostname.toLowerCase() === 'www.github.com') {
      const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
      const owner = parts[0];
      const repoPart = parts[1];
      if (owner && repoPart) {
        const repo = repoPart.replace(/\.git$/i, '');
        const candidate = `${owner}/${repo}`;
        if (GITHUB_REPO_REGEX.test(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

export function validateRepoPath(rawPath: string): string {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return '';
  }

  // Reject null bytes before decoding
  if (rawPath.includes('\0')) {
    throw new GitHubSyncError('Invalid path: null bytes are forbidden', 'INVALID_PATH', 400);
  }

  // Reject URL schemes or protocol injection before decoding
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawPath) || rawPath.startsWith('//') || rawPath.startsWith('\\\\')) {
    throw new GitHubSyncError('Invalid path: URL schemes are forbidden', 'INVALID_PATH', 400);
  }

  // Normalize separators and decode
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw new GitHubSyncError('Invalid path: malformed URL encoding', 'INVALID_PATH', 400);
  }

  // Reject null bytes after decoding
  if (decoded.includes('\0')) {
    throw new GitHubSyncError('Invalid path: null bytes are forbidden', 'INVALID_PATH', 400);
  }

  // Reject URL schemes or protocol injection after decoding
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded) || decoded.startsWith('//') || decoded.startsWith('\\\\')) {
    throw new GitHubSyncError('Invalid path: URL schemes are forbidden', 'INVALID_PATH', 400);
  }

  // Replace backslashes with forward slashes
  decoded = decoded.replace(/\\/g, '/');

  // Split into segments and validate each
  const segments = decoded.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      throw new GitHubSyncError('Invalid path: directory traversal is forbidden', 'INVALID_PATH', 400);
    }
    // Only allow safe characters in path segments
    if (/[\0<>:"|?*]/.test(seg)) {
      throw new GitHubSyncError('Invalid path: forbidden characters in path segment', 'INVALID_PATH', 400);
    }
  }

  return segments.join('/');
}

export function validateRepoRef(rawRef?: string): string | undefined {
  if (!rawRef || typeof rawRef !== 'string') return undefined;
  const trimmed = rawRef.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.includes('..') ||
    /[\0<>:"|?*\\~^ \t\r\n]/.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.endsWith('/')
  ) {
    throw new GitHubSyncError('Invalid ref: forbidden characters in git reference', 'INVALID_PATH', 400);
  }
  return trimmed;
}

// Bounded in-memory response cache (TTL 60s, max 100 entries)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const treeCache = new Map<string, CacheEntry<GitHubRepoItem[]>>();
const fileCache = new Map<string, CacheEntry<GitHubFileContent>>();
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;

// User repositories cache (5 min TTL)
interface UserReposCacheEntry {
  data: GitHubRepoSummary[];
  expiresAt: number;
  cachedAt: number;
}
const userReposCache = new Map<string, UserReposCacheEntry>();
const inFlightUserRepos = new Map<string, Promise<GitHubRepoSummary[]>>();
export const USER_REPOS_CACHE_TTL_MS = 5 * 60_000;
export const REFRESH_COOLDOWN_MS = 10_000;

function pruneCache<T>(cache: Map<string, CacheEntry<T>>) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export function clearGitHubUserCache(): void {
  userReposCache.clear();
  inFlightUserRepos.clear();
}

export function clearGitHubCache(): void {
  treeCache.clear();
  fileCache.clear();
  userReposCache.clear();
  inFlightUserRepos.clear();
}

export async function fetchGitHubRepoMetadata(
  repoInput: string,
  token?: string,
  signalTimeoutMs = 8000
): Promise<GitHubRepoMetadata> {
  const repo = parseGitHubRepo(repoInput);
  if (!repo) {
    throw new GitHubSyncError(
      'Invalid repository identifier. Expected format: "owner/repo" or "https://github.com/owner/repo"',
      'INVALID_REPO',
      400
    );
  }

  const headers: Record<string, string> = {
    'User-Agent': 'MimiOS-Portfolio',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      signal: AbortSignal.timeout(signalTimeoutMs),
    });
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('aborted'));
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new GitHubSyncError(
      isTimeout ? 'GitHub API request timed out' : `GitHub API request failed: ${message}`,
      isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      isTimeout ? 504 : 502
    );
  }

  if (response.status === 404) {
    throw new GitHubSyncError(`GitHub repository "${repo}" not found`, 'NOT_FOUND', 404);
  }

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const msg = rateLimitRemaining === '0'
      ? 'GitHub API rate limit exceeded. Please wait before retrying.'
      : 'GitHub API access forbidden.';
    throw new GitHubSyncError(msg, 'RATE_LIMITED', 403);
  }

  if (!response.ok) {
    throw new GitHubSyncError(`GitHub API error (${response.status})`, 'GITHUB_API_ERROR', 502);
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new GitHubSyncError('Failed to parse GitHub API response as JSON', 'GITHUB_API_ERROR', 502);
  }

  const stars = typeof data.stargazers_count === 'number' && Number.isFinite(data.stargazers_count)
    ? Math.max(0, Math.floor(data.stargazers_count))
    : 0;
  const forks = typeof data.forks_count === 'number' && Number.isFinite(data.forks_count)
    ? Math.max(0, Math.floor(data.forks_count))
    : 0;
  const openIssues = typeof data.open_issues_count === 'number' && Number.isFinite(data.open_issues_count)
    ? Math.max(0, Math.floor(data.open_issues_count))
    : 0;
  const language = typeof data.language === 'string' && data.language.trim().length > 0
    ? data.language.slice(0, 50)
    : null;
  const topics = Array.isArray(data.topics)
    ? data.topics.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 50)).slice(0, 30)
    : [];
  const updatedAt = typeof data.updated_at === 'string' ? data.updated_at : new Date().toISOString();
  const pushedAt = typeof data.pushed_at === 'string' ? data.pushed_at : updatedAt;
  const defaultBranch = typeof data.default_branch === 'string' && data.default_branch.trim().length > 0
    ? data.default_branch.slice(0, 100)
    : 'main';
  const htmlUrl = typeof data.html_url === 'string' && data.html_url.startsWith('https://')
    ? data.html_url
    : `https://github.com/${repo}`;
  const description = typeof data.description === 'string' ? data.description.slice(0, 500) : null;
  const homepage = typeof data.homepage === 'string' && data.homepage.trim().length > 0
    ? data.homepage.slice(0, 2048)
    : null;
  const name = typeof data.name === 'string' && data.name.trim().length > 0
    ? data.name.slice(0, 100)
    : repo.split('/')[1] || repo;
  const fullName = typeof data.full_name === 'string' && data.full_name.trim().length > 0
    ? data.full_name.slice(0, 200)
    : repo;

  return {
    repo,
    name,
    full_name: fullName,
    description,
    html_url: htmlUrl,
    homepage,
    language,
    topics,
    stars,
    forks,
    open_issues: openIssues,
    default_branch: defaultBranch,
    updated_at: updatedAt,
    pushed_at: pushedAt,
  };
}

export async function fetchRepoTree(
  repoInput: string,
  rawPath = '',
  ref?: string,
  token?: string,
  signalTimeoutMs = 8000
): Promise<GitHubRepoItem[]> {
  const repo = parseGitHubRepo(repoInput);
  if (!repo) {
    throw new GitHubSyncError('Invalid repository identifier', 'INVALID_REPO', 400);
  }

  const cleanPath = validateRepoPath(rawPath);
  const cleanRef = validateRepoRef(ref);
  const cacheKey = `${repo}:${cleanPath}:${cleanRef || ''}`;

  pruneCache(treeCache);
  const cached = treeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const headers: Record<string, string> = {
    'User-Agent': 'MimiOS-Portfolio',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  let url = `https://api.github.com/repos/${repo}/contents/${cleanPath}`;
  if (cleanRef) {
    url += `?ref=${encodeURIComponent(cleanRef)}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(signalTimeoutMs),
    });
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('aborted'));
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new GitHubSyncError(
      isTimeout ? 'GitHub API request timed out' : `GitHub API request failed: ${message}`,
      isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      isTimeout ? 504 : 502
    );
  }

  if (response.status === 404) {
    throw new GitHubSyncError(`Path "${cleanPath || '/'}" not found in repository "${repo}"`, 'NOT_FOUND', 404);
  }

  if (response.status === 401) {
    throw new GitHubSyncError('GitHub API authentication failed or repository requires authentication', 'RATE_LIMITED', 401);
  }

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const msg = rateLimitRemaining === '0'
      ? 'GitHub API rate limit exceeded. Please wait before retrying.'
      : 'GitHub API access forbidden or repository is private.';
    throw new GitHubSyncError(msg, 'RATE_LIMITED', 403);
  }

  if (!response.ok) {
    throw new GitHubSyncError(`GitHub API error (${response.status})`, 'GITHUB_API_ERROR', 502);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GitHubSyncError('Failed to parse GitHub response as JSON', 'GITHUB_API_ERROR', 502);
  }

  if (!Array.isArray(data)) {
    throw new GitHubSyncError('Target path is a file, not a directory', 'INVALID_PATH', 400);
  }

  const items: GitHubRepoItem[] = data.map((item: Record<string, unknown>) => {
    const rawType = String(item.type || 'file');
    const type: 'file' | 'dir' | 'submodule' | 'symlink' =
      rawType === 'dir' ? 'dir' : (rawType === 'submodule' ? 'submodule' : (rawType === 'symlink' ? 'symlink' : 'file'));
    return {
      name: String(item.name || ''),
      path: String(item.path || ''),
      type,
      size: typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 0,
      sha: String(item.sha || ''),
      html_url: String(item.html_url || ''),
      download_url: typeof item.download_url === 'string' ? item.download_url : null,
    };
  });

  // Sort: directories first, then alphabetical
  items.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  treeCache.set(cacheKey, { data: items, expiresAt: Date.now() + CACHE_TTL_MS });
  return items;
}

export async function fetchRepoFile(
  repoInput: string,
  rawPath: string,
  ref?: string,
  token?: string,
  maxSizeBytes = 1024 * 1024, // 1 MB limit
  signalTimeoutMs = 8000
): Promise<GitHubFileContent> {
  const repo = parseGitHubRepo(repoInput);
  if (!repo) {
    throw new GitHubSyncError('Invalid repository identifier', 'INVALID_REPO', 400);
  }

  const cleanPath = validateRepoPath(rawPath);
  if (!cleanPath) {
    throw new GitHubSyncError('A file path is required', 'INVALID_PATH', 400);
  }

  const cleanRef = validateRepoRef(ref);
  const cacheKey = `${repo}:${cleanPath}:${cleanRef || ''}`;
  pruneCache(fileCache);
  const cached = fileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const headers: Record<string, string> = {
    'User-Agent': 'MimiOS-Portfolio',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  let url = `https://api.github.com/repos/${repo}/contents/${cleanPath}`;
  if (cleanRef) {
    url += `?ref=${encodeURIComponent(cleanRef)}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(signalTimeoutMs),
    });
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('aborted'));
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new GitHubSyncError(
      isTimeout ? 'GitHub API request timed out' : `GitHub API request failed: ${message}`,
      isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      isTimeout ? 504 : 502
    );
  }

  if (response.status === 404) {
    throw new GitHubSyncError(`File "${cleanPath}" not found in repository "${repo}"`, 'NOT_FOUND', 404);
  }

  if (response.status === 401) {
    throw new GitHubSyncError('GitHub API authentication failed or repository requires authentication', 'RATE_LIMITED', 401);
  }

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const msg = rateLimitRemaining === '0'
      ? 'GitHub API rate limit exceeded. Please wait before retrying.'
      : 'GitHub API access forbidden or repository is private.';
    throw new GitHubSyncError(msg, 'RATE_LIMITED', 403);
  }

  if (!response.ok) {
    throw new GitHubSyncError(`GitHub API error (${response.status})`, 'GITHUB_API_ERROR', 502);
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new GitHubSyncError('Failed to parse GitHub response as JSON', 'GITHUB_API_ERROR', 502);
  }

  if (Array.isArray(data) || data.type === 'dir') {
    throw new GitHubSyncError('Target path is a directory, not a file', 'INVALID_PATH', 400);
  }

  const size = typeof data.size === 'number' && Number.isFinite(data.size) ? data.size : 0;
  const name = String(data.name || cleanPath.split('/').pop() || cleanPath);
  const path = String(data.path || cleanPath);
  const sha = String(data.sha || '');
  const htmlUrl = String(data.html_url || `https://github.com/${repo}/blob/${cleanRef || 'main'}/${cleanPath}`);
  const downloadUrl = typeof data.download_url === 'string' ? data.download_url : null;

  if (size > maxSizeBytes) {
    throw new GitHubSyncError(
      `File is too large to preview (${(size / (1024 * 1024)).toFixed(2)} MB exceeds 1 MB limit). Open on GitHub.`,
      'FILE_TOO_LARGE',
      413
    );
  }

  let content = '';
  let isBinary = false;
  let encoding: 'utf-8' | 'base64' | 'binary' = 'utf-8';

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);

  if (typeof data.content === 'string' && data.encoding === 'base64') {
    const cleanBase64 = data.content.replace(/[\r\n\s]/g, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (isImage) {
      const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      content = `data:${mime};base64,${cleanBase64}`;
      encoding = 'base64';
    } else if (ext === 'pdf') {
      content = `data:application/pdf;base64,${cleanBase64}`;
      encoding = 'base64';
      isBinary = true;
    } else {
      // Check for binary content (null bytes in first 512 bytes)
      const sample = buffer.subarray(0, 512);
      if (sample.includes(0x00)) {
        isBinary = true;
        encoding = 'binary';
        content = '';
      } else {
        content = buffer.toString('utf-8');
        encoding = 'utf-8';
      }
    }
  }

  const result: GitHubFileContent = {
    name,
    path,
    size,
    sha,
    html_url: htmlUrl,
    download_url: downloadUrl,
    encoding,
    content,
    isBinary,
    isOversized: false,
  };

  fileCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export const FALLBACK_REPOSITORIES: GitHubRepoSummary[] = [
  {
    id: 1409806170,
    name: 'portfolio-server',
    full_name: 'pratyushrobert/portfolio-server',
    description: null,
    html_url: 'https://github.com/pratyushrobert/portfolio-server',
    default_branch: 'main',
    language: 'TypeScript',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-10-08T17:09:06Z',
    pushed_at: '2026-10-08T17:09:01Z',
    size: 99,
    archived: false,
    fork: false,
  },
  {
    id: 1399266299,
    name: 'portfolio',
    full_name: 'pratyushrobert/portfolio',
    description: null,
    html_url: 'https://github.com/pratyushrobert/portfolio',
    default_branch: 'main',
    language: 'TypeScript',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-10-08T17:08:32Z',
    pushed_at: '2026-10-08T17:08:27Z',
    size: 994,
    archived: false,
    fork: false,
  },
  {
    id: 1394491155,
    name: 'pratyushrobert',
    full_name: 'pratyushrobert/pratyushrobert',
    description: null,
    html_url: 'https://github.com/pratyushrobert/pratyushrobert',
    default_branch: 'main',
    language: null,
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-09-30T04:20:24Z',
    pushed_at: '2026-10-08T04:41:00Z',
    size: 22,
    archived: false,
    fork: false,
  },
  {
    id: 1391813083,
    name: 'Hash-Identifier',
    full_name: 'pratyushrobert/Hash-Identifier',
    description: null,
    html_url: 'https://github.com/pratyushrobert/Hash-Identifier',
    default_branch: 'main',
    language: 'Python',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-09-28T04:45:22Z',
    pushed_at: '2026-09-28T04:45:19Z',
    size: 6,
    archived: false,
    fork: false,
  },
  {
    id: 1384673607,
    name: 'Orbital-Sentinal',
    full_name: 'pratyushrobert/Orbital-Sentinal',
    description: null,
    html_url: 'https://github.com/pratyushrobert/Orbital-Sentinal',
    default_branch: 'main',
    language: 'TypeScript',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-09-24T04:48:51Z',
    pushed_at: '2026-09-24T04:48:47Z',
    size: 87,
    archived: false,
    fork: false,
  },
  {
    id: 1359057181,
    name: 'secvault',
    full_name: 'pratyushrobert/secvault',
    description: null,
    html_url: 'https://github.com/pratyushrobert/secvault',
    default_branch: 'main',
    language: 'Python',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-09-06T11:27:32Z',
    pushed_at: '2026-09-06T11:27:28Z',
    size: 93,
    archived: false,
    fork: false,
  },
  {
    id: 1312100964,
    name: 'photoholics',
    full_name: 'pratyushrobert/photoholics',
    description: null,
    html_url: 'https://github.com/pratyushrobert/photoholics',
    default_branch: 'main',
    language: 'TypeScript',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-08-10T11:09:02Z',
    pushed_at: '2026-08-10T11:08:17Z',
    size: 153,
    archived: false,
    fork: false,
  },
  {
    id: 1308994042,
    name: 'learning_Scripting',
    full_name: 'pratyushrobert/learning_Scripting',
    description: "In this repo i'll upload every script ill learn",
    html_url: 'https://github.com/pratyushrobert/learning_Scripting',
    default_branch: 'main',
    language: 'Shell',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-07-23T15:47:29Z',
    pushed_at: '2026-07-23T15:46:54Z',
    size: 1,
    archived: false,
    fork: false,
  },
  {
    id: 1187312717,
    name: 'test',
    full_name: 'pratyushrobert/test',
    description: 'test repo',
    html_url: 'https://github.com/pratyushrobert/test',
    default_branch: 'main',
    language: 'Python',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-03-25T15:46:49Z',
    pushed_at: '2026-03-25T15:43:06Z',
    size: 7,
    archived: false,
    fork: false,
  },
  {
    id: 1178167095,
    name: 'NIDS',
    full_name: 'pratyushrobert/NIDS',
    description:
      'Python-based Network Intrusion Detection System (NIDS) that monitors live network traffic and detects suspicious activities such as port scans, SYN flood attacks, DNS tunneling, and malicious IPs. Built using Scapy for packet capture with real-time alerting, logging, and a web dashboard to visualize detected threats and network activity.',
    html_url: 'https://github.com/pratyushrobert/NIDS',
    default_branch: 'main',
    language: 'HTML',
    topics: [],
    stargazers_count: 0,
    forks_count: 1,
    updated_at: '2026-03-16T17:58:06Z',
    pushed_at: '2026-03-16T17:58:03Z',
    size: 12,
    archived: false,
    fork: false,
  },
  {
    id: 1167772695,
    name: 'BETTER',
    full_name: 'pratyushrobert/BETTER',
    description: 'THIS IS A PROJECT DO NOT COPY IT MADE ON 20th FEB and Uploading on 26th FEB',
    html_url: 'https://github.com/pratyushrobert/BETTER',
    default_branch: 'main',
    language: 'HTML',
    topics: [],
    stargazers_count: 1,
    forks_count: 0,
    updated_at: '2026-03-10T18:52:18Z',
    pushed_at: '2026-03-01T14:23:47Z',
    size: 328,
    archived: false,
    fork: false,
  },
];

export async function fetchUserRepositories(
  username: string,
  token?: string,
  forceRefresh = false,
  signalTimeoutMs = 10000
): Promise<GitHubRepoSummary[]> {
  const cleanUsername = username.trim();
  if (!cleanUsername || !GITHUB_USERNAME_REGEX.test(cleanUsername)) {
    throw new GitHubSyncError('Invalid GitHub username configuration', 'INVALID_REPO', 400);
  }

  const cacheKey = cleanUsername.toLowerCase();
  const existingEntry = userReposCache.get(cacheKey);
  const now = Date.now();

  // If not force-refreshing, use valid unexpired cache
  if (!forceRefresh && existingEntry && existingEntry.expiresAt > now) {
    return existingEntry.data;
  }

  // If forceRefresh requested, but we already have freshly cached data fetched within cooldown window (10s),
  // return existingEntry to prevent rate-limit exhaustion and unnecessary repeated upstream requests.
  if (forceRefresh && existingEntry && now - existingEntry.cachedAt < REFRESH_COOLDOWN_MS) {
    return existingEntry.data;
  }

  // Deduplicate concurrent in-flight requests for the same username
  const existingInFlight = inFlightUserRepos.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const fetchPromise = (async (): Promise<GitHubRepoSummary[]> => {
    const headers: Record<string, string> = {
      'User-Agent': 'MimiOS-Portfolio',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token && token.trim().length > 0) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    const allRepos: GitHubRepoSummary[] = [];
    let page = 1;
    const maxPages = 5; // Bounded to 500 repos max
    const perPage = 100;

    while (page <= maxPages) {
      const url = `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?type=owner&sort=updated&per_page=${perPage}&page=${page}`;

      let response: Response;
      try {
        response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(signalTimeoutMs),
        });
      } catch (err: unknown) {
        if (existingEntry) {
          return existingEntry.data;
        }
        if (cleanUsername.toLowerCase() === 'pratyushrobert') {
          userReposCache.set(cacheKey, {
            data: FALLBACK_REPOSITORIES,
            expiresAt: Date.now() + USER_REPOS_CACHE_TTL_MS,
            cachedAt: Date.now(),
          });
          return FALLBACK_REPOSITORIES;
        }
        const isTimeout =
          err instanceof Error &&
          (err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('aborted'));
        const message = err instanceof Error ? err.message : 'Unknown network failure';
        throw new GitHubSyncError(
          isTimeout ? 'GitHub API request timed out' : `GitHub API request failed: ${message}`,
          isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          isTimeout ? 504 : 502
        );
      }

      if (response.status === 404) {
        throw new GitHubSyncError(`GitHub user "${cleanUsername}" not found`, 'NOT_FOUND', 404);
      }

      if (response.status === 403 || response.status === 429) {
        if (existingEntry) {
          return existingEntry.data;
        }
        if (cleanUsername.toLowerCase() === 'pratyushrobert') {
          userReposCache.set(cacheKey, {
            data: FALLBACK_REPOSITORIES,
            expiresAt: Date.now() + USER_REPOS_CACHE_TTL_MS,
            cachedAt: Date.now(),
          });
          return FALLBACK_REPOSITORIES;
        }
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const msg = rateLimitRemaining === '0' || response.status === 429
          ? 'GitHub API rate limit exceeded. Please wait before retrying.'
          : 'GitHub API access forbidden.';
        throw new GitHubSyncError(msg, 'RATE_LIMITED', 429);
      }

      if (!response.ok) {
        if (existingEntry) {
          return existingEntry.data;
        }
        if (cleanUsername.toLowerCase() === 'pratyushrobert') {
          userReposCache.set(cacheKey, {
            data: FALLBACK_REPOSITORIES,
            expiresAt: Date.now() + USER_REPOS_CACHE_TTL_MS,
            cachedAt: Date.now(),
          });
          return FALLBACK_REPOSITORIES;
        }
        throw new GitHubSyncError(`GitHub API error (${response.status})`, 'GITHUB_API_ERROR', 502);
      }

      let pageData: unknown;
      try {
        pageData = await response.json();
      } catch {
        if (existingEntry) {
          return existingEntry.data;
        }
        if (cleanUsername.toLowerCase() === 'pratyushrobert') {
          userReposCache.set(cacheKey, {
            data: FALLBACK_REPOSITORIES,
            expiresAt: Date.now() + USER_REPOS_CACHE_TTL_MS,
            cachedAt: Date.now(),
          });
          return FALLBACK_REPOSITORIES;
        }
        throw new GitHubSyncError('Failed to parse GitHub response as JSON', 'GITHUB_API_ERROR', 502);
      }

      if (!Array.isArray(pageData) || pageData.length === 0) {
        break;
      }

      for (const raw of pageData) {
        const item = raw as Record<string, unknown>;
        // Filter: Exclude private repos and forks
        if (item.private === true) continue;
        if (item.fork === true) continue;

        const id = typeof item.id === 'number' ? item.id : 0;
        const name = typeof item.name === 'string' ? item.name.slice(0, 100) : '';
        const fullName = typeof item.full_name === 'string' ? item.full_name.slice(0, 200) : `${cleanUsername}/${name}`;
        const description = typeof item.description === 'string' ? item.description.slice(0, 500) : null;
        const htmlUrl = typeof item.html_url === 'string' && item.html_url.startsWith('https://')
          ? item.html_url
          : `https://github.com/${cleanUsername}/${name}`;
        const defaultBranch = typeof item.default_branch === 'string' && item.default_branch.trim().length > 0
          ? item.default_branch.slice(0, 100)
          : 'main';
        const language = typeof item.language === 'string' && item.language.trim().length > 0
          ? item.language.slice(0, 50)
          : null;
        const topics = Array.isArray(item.topics)
          ? item.topics.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 50)).slice(0, 30)
          : [];
        const stars = typeof item.stargazers_count === 'number' && Number.isFinite(item.stargazers_count)
          ? Math.max(0, Math.floor(item.stargazers_count))
          : 0;
        const forks = typeof item.forks_count === 'number' && Number.isFinite(item.forks_count)
          ? Math.max(0, Math.floor(item.forks_count))
          : 0;
        const size = typeof item.size === 'number' && Number.isFinite(item.size)
          ? Math.max(0, Math.floor(item.size))
          : 0;
        const updatedAt = typeof item.updated_at === 'string' ? item.updated_at : new Date().toISOString();
        const pushedAt = typeof item.pushed_at === 'string' ? item.pushed_at : updatedAt;
        const archived = Boolean(item.archived);

        allRepos.push({
          id,
          name,
          full_name: fullName,
          description,
          html_url: htmlUrl,
          default_branch: defaultBranch,
          language,
          topics,
          stargazers_count: stars,
          forks_count: forks,
          updated_at: updatedAt,
          pushed_at: pushedAt,
          size,
          archived,
          fork: false,
        });
      }

      if (pageData.length < perPage) {
        break;
      }
      page++;
    }

    userReposCache.set(cacheKey, {
      data: allRepos,
      expiresAt: Date.now() + USER_REPOS_CACHE_TTL_MS,
      cachedAt: Date.now(),
    });

    return allRepos;
  })();

  inFlightUserRepos.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightUserRepos.delete(cacheKey);
  }
}
