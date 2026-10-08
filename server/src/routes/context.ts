import type { AppDatabase } from '../db/index.js';
import type { RuntimeConfig } from '../config/env.js';
import type { AuthService } from '../services/auth.js';
import type { StorageService } from '../services/storage.js';

export interface RouteContext {
  database: AppDatabase;
  authService: AuthService;
  storageService: StorageService;
  config: RuntimeConfig;
}

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export function publicAsset(row: Record<string, unknown>, storageService?: StorageService): Record<string, unknown> {
  const assetPath = String(row.asset_path);
  let url = `/uploads/${assetPath}`;
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    url = assetPath;
  } else if (storageService?.isExternalStorage) {
    url = storageService.getPublicUrl(assetPath);
  }

  return {
    ...row,
    tags: parseJsonArray(row.tags),
    url,
    featured: Boolean(row.featured),
    visibility: Boolean(row.visibility),
  };
}

export function publicProject(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    technologies: parseJsonArray(row.technologies),
    github_topics: parseJsonArray(row.github_topics),
    featured: Boolean(row.featured),
  };
}

export function publicSkill(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, visibility: Boolean(row.visibility) };
}

export function publicExperience(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    technologies: parseJsonArray(row.technologies),
    visibility: Boolean(row.visibility),
  };
}

export function publicCertificate(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, visibility: Boolean(row.visibility) };
}
