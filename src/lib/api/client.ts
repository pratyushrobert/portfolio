/** Backend requests only. Visitor VirtualFS/IndexedDB data never enters this client. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = 'REQUEST_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getApiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => { unauthorizedListeners.delete(listener); };
}

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
  if (!base) {
    return path;
  }
  try {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid API address');
    }
  } catch {
    throw new ApiError('The API address is not configured correctly.', 0, 'API_NOT_CONFIGURED');
  }
  return `${base}${path}`;
}

function httpError(status: number, path: string): ApiError {
  let message = 'The request could not be completed. Please try again.';
  if (status === 401) message = path === '/api/auth/login' ? 'Invalid email or password.' : 'Please sign in to continue.';
  else if (status === 403) message = 'You do not have permission to perform this action.';
  else if (status === 404) message = 'The requested item was not found.';
  else if (status === 400 || status === 422) message = 'Please check the submitted information.';
  else if (status === 413) message = 'The upload is too large.';
  else if (status === 415) message = 'This upload format is not supported.';
  else if (status === 429) message = 'Too many attempts. Please wait a minute and try again.';
  else if (status >= 500) message = 'The server is temporarily unavailable. Please try again later.';
  // Never forward backend error messages, stack traces, or response bodies into the UI.
  return new ApiError(message, status, 'HTTP_ERROR');
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(path: `/api/${string}`, options: RequestOptions = {}): Promise<T> {
  const url = apiUrl(path);
  const headers = new Headers({ Accept: 'application/json' });
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body; // The browser supplies the multipart boundary.
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }

  if (response.status === 401 && (path.startsWith('/api/admin/') || path === '/api/auth/me')) {
    for (const listener of unauthorizedListeners) listener();
  }
  if (!response.ok) throw httpError(response.status, path);
  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The server returned an unexpected response.', response.status, 'INVALID_RESPONSE');
  }
  if (typeof payload !== 'object' || payload === null || !('success' in payload) || payload.success !== true) {
    throw new ApiError('The server returned an unexpected response.', response.status, 'INVALID_RESPONSE');
  }
  // Existing endpoints return { success: true, data? }; logout/delete have no data.
  return ('data' in payload ? payload.data : undefined) as T;
}
