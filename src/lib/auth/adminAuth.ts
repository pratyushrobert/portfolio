import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { authApi } from '../api/auth';
import { adminApi } from '../api/admin';
import type { AdminUser, LoginCredentials } from '../api/auth';
import { ApiError, getApiErrorMessage, onUnauthorized } from '../api/client';

export type AdminAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AdminAuthSnapshot {
  status: AdminAuthStatus;
  user: AdminUser | null;
  error: string | null;
}

let snapshot: AdminAuthSnapshot = { status: 'loading', user: null, error: null };
const serverSnapshot: AdminAuthSnapshot = { status: 'unauthenticated', user: null, error: null };
let checkPromise: Promise<AdminUser | null> | null = null;
let authGeneration = 0;
const listeners = new Set<() => void>();

function emit(next: AdminAuthSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): AdminAuthSnapshot {
  return snapshot;
}

function getServerSnapshot(): AdminAuthSnapshot {
  return serverSnapshot;
}

export async function checkAdminSession(): Promise<AdminUser | null> {
  if (checkPromise) return checkPromise;

  const generation = authGeneration;
  emit({ status: 'loading', user: null, error: null });
  checkPromise = authApi.me()
    .then((user) => {
      if (generation !== authGeneration) return null;
      emit({ status: 'authenticated', user, error: null });
      return user;
    })
    .catch((error: unknown) => {
      if (generation !== authGeneration) return null;
      if (error instanceof ApiError && error.status === 401) {
        emit({ status: 'unauthenticated', user: null, error: null });
        return null;
      }
      emit({ status: 'unauthenticated', user: null, error: getApiErrorMessage(error) });
      return null;
    })
    .finally(() => {
      if (generation === authGeneration) checkPromise = null;
    });

  return checkPromise;
}

export function invalidateAdminAuth(): void {
  authGeneration += 1;
  checkPromise = null;
  emit({ status: 'unauthenticated', user: null, error: null });
}

const unsubscribe = onUnauthorized(invalidateAdminAuth);
if (import.meta.hot) import.meta.hot.dispose(unsubscribe);

export async function loginAdmin(credentials: LoginCredentials): Promise<AdminUser> {
  authGeneration += 1;
  checkPromise = null;
  const generation = authGeneration;
  emit({ status: 'loading', user: null, error: null });
  try {
    await authApi.login(credentials);
    // Confirm the HttpOnly cookie through the backend instead of trusting a local flag.
    const user = await authApi.me();
    if (generation !== authGeneration) throw new ApiError('Please sign in again.', 401, 'SESSION_CHANGED');
    emit({ status: 'authenticated', user, error: null });
    return user;
  } catch (error) {
    if (generation === authGeneration) {
      emit({ status: 'unauthenticated', user: null, error: getApiErrorMessage(error) });
    }
    throw error;
  }
}

export async function logoutAdmin(): Promise<void> {
  authGeneration += 1;
  checkPromise = null;
  try {
    await authApi.logout();
  } finally {
    // Fail closed locally even if the network prevents confirming server logout.
    invalidateAdminAuth();
  }
}

export async function logoutAllAdminSessions(): Promise<{ invalidated_sessions: number }> {
  authGeneration += 1;
  checkPromise = null;
  try {
    return await adminApi.logoutAllSessions();
  } finally {
    invalidateAdminAuth();
  }
}

export function useAdminAuth() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (snapshot.status === 'loading') void checkAdminSession();
  }, []);
  const refresh = useCallback(() => checkAdminSession(), []);
  return { ...current, refresh };
}
