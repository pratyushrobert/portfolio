import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, LoginCredentials } from '../types/auth';
import { DEFAULT_ADMIN_USER, DEFAULT_PASSWORD_HASH } from '../types/auth';

// Simple hash function for demo purposes
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => boolean;
  logout: () => void;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      username: null,
      loginTime: null,

      login: (credentials) => {
        const hashedPassword = simpleHash(credentials.password);
        if (credentials.username === DEFAULT_ADMIN_USER && hashedPassword === simpleHash(DEFAULT_PASSWORD_HASH)) {
          set({
            isAuthenticated: true,
            username: credentials.username,
            loginTime: Date.now(),
          });
          return true;
        }
        return false;
      },

      logout: () =>
        set({
          isAuthenticated: false,
          username: null,
          loginTime: null,
        }),

      checkAuth: () => get().isAuthenticated,
    }),
    {
      name: 'pratyushos-auth',
    }
  )
);