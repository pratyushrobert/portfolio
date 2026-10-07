import type { AppDatabase } from '../db/index.js';
import type { RuntimeConfig } from '../config/env.js';
import type { AuthService } from '../services/auth.js';

export interface RouteContext {
  database: AppDatabase;
  authService: AuthService;
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

export function publicAsset(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    tags: parseJsonArray(row.tags),
    url: `/uploads/${String(row.asset_path)}`,
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
