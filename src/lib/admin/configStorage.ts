/**
 * MimiOS Admin Configuration Storage
 *
 * DEVELOPMENT ONLY - Uses localStorage for local development.
 * This is NOT secure and will be replaced with server-side storage.
 *
 * DO NOT use this in production.
 * DO NOT store sensitive data here.
 * This is a local development configuration layer ONLY.
 */

import type { AdminConfig } from './types';
import { DEFAULT_ADMIN_CONFIG } from './types';

const STORAGE_KEY = 'mimios_admin_config';

/**
 * Load admin configuration from localStorage.
 * Returns default config if nothing stored.
 */
export function loadAdminConfig(): AdminConfig {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_ADMIN_CONFIG;

    const parsed = JSON.parse(stored);

    // Merge with defaults to handle new fields
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_ADMIN_CONFIG;
  }
}

/**
 * Save admin configuration to localStorage.
 */
export function saveAdminConfig(config: AdminConfig): void {
  if (typeof window === 'undefined') return;

  try {
    const configToSave = {
      ...config,
      settings: {
        ...config.settings,
        lastModified: new Date().toISOString(),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
  } catch {
    // Ignore storage errors (quota, private mode, etc.)
  }
}

/**
 * Reset admin configuration to defaults.
 * Does NOT affect visitor files, IndexedDB, or built-in assets.
 */
export function resetAdminConfig(): AdminConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  return DEFAULT_ADMIN_CONFIG;
}

/**
 * Merge stored config with defaults to handle new fields.
 */
function mergeWithDefaults(stored: Partial<AdminConfig>): AdminConfig {
  return {
    appearance: { ...DEFAULT_ADMIN_CONFIG.appearance, ...stored.appearance },
    portfolio: { ...DEFAULT_ADMIN_CONFIG.portfolio, ...stored.portfolio },
    projects: stored.projects?.length ? stored.projects : DEFAULT_ADMIN_CONFIG.projects,
    skills: stored.skills?.length ? stored.skills : DEFAULT_ADMIN_CONFIG.skills,
    experience: stored.experience?.length ? stored.experience : DEFAULT_ADMIN_CONFIG.experience,
    certificates: stored.certificates?.length ? stored.certificates : DEFAULT_ADMIN_CONFIG.certificates,
    assets: stored.assets?.length ? stored.assets : DEFAULT_ADMIN_CONFIG.assets,
    settings: { ...DEFAULT_ADMIN_CONFIG.settings, ...stored.settings },
  };
}

/**
 * Check if admin configuration exists (has been modified from defaults).
 */
export function hasAdminConfig(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}