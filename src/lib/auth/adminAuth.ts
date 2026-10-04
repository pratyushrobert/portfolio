/**
 * MimiOS Admin Authentication
 *
 * DEVELOPMENT ONLY - This is a temporary static password implementation.
 * Will be replaced with proper server-side authentication before production.
 *
 * DO NOT use this in production.
 * DO NOT store the password in localStorage/IndexedDB.
 * DO NOT expose the password in logs, error messages, or terminal history.
 */

const DEV_ADMIN_PASSWORD = 'mimiisbest@1@';

/**
 * Authenticate admin with the provided password.
 *
 * @param password - The password to verify
 * @returns true if authentication succeeds
 */
export function authenticateAdmin(password: string): boolean {
  return password === DEV_ADMIN_PASSWORD;
}

/**
 * Check if a session is authenticated.
 * For development, this just checks a session flag.
 * In production, this would validate a JWT or session token.
 *
 * @returns true if admin is authenticated
 */
export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem('mimios_admin_auth') === 'true';
  } catch {
    return false;
  }
}

/**
 * Set admin authentication state.
 *
 * @param authenticated - Whether admin is authenticated
 */
export function setAdminAuthenticated(authenticated: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (authenticated) {
      sessionStorage.setItem('mimios_admin_auth', 'true');
    } else {
      sessionStorage.removeItem('mimios_admin_auth');
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear admin authentication.
 */
export function clearAdminAuth(): void {
  setAdminAuthenticated(false);
}