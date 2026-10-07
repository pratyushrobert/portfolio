import { ApiError, request } from './client';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export const authApi = {
  // Passwords are used only for this request; never kept in a cache or browser storage.
  login: (credentials: LoginCredentials) => request<{ user: AdminUser }>('/api/auth/login', { method: 'POST', body: credentials }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  async me(signal?: AbortSignal): Promise<AdminUser> {
    const data = await request<{ user: AdminUser }>('/api/auth/me', { signal });
    const user = data?.user;
    if (!user || user.role !== 'admin' || typeof user.id !== 'string' || typeof user.email !== 'string' || typeof user.name !== 'string') {
      throw new ApiError('The server returned an unexpected response.', 200, 'INVALID_RESPONSE');
    }
    return user;
  },
};
