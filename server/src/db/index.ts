import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { RuntimeConfig } from '../config/env.js';
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export type AppDatabase = ReturnType<typeof Database>;

const defaultConfigs = [
  ['site_name', 'MimiOS Portfolio', 'Site name displayed in the header'],
  ['site_title', 'Full-stack Developer', 'Short title'],
  ['site_description', 'Building creative web experiences', 'Short description for SEO'],
  ['site_keywords', 'React, TypeScript, Node.js, Python, Go, Portfolio', 'SEO keywords'],
  ['contact_email', 'contact@example.com', 'Contact email'],
  ['contact_github', 'https://github.com/', 'GitHub profile'],
  ['contact_linkedin', 'https://linkedin.com/', 'LinkedIn profile'],
  ['contact_website', '', 'Personal website'],
  ['wallpaper_url', '', 'Desktop wallpaper URL'],
  ['wallpaper_position', 'center', 'Wallpaper position'],
  ['wallpaper_size', 'cover', 'Wallpaper size'],
  ['wallpaper_overlay', 'rgba(0, 0, 0, 0.3)', 'Wallpaper overlay'],
  ['wallpaper_color', '#08090d', 'Wallpaper fallback color'],
  ['wallpaper_brightness', '100', 'Wallpaper brightness percentage'],
  ['wallpaper_overlay_opacity', '30', 'Wallpaper overlay darkness percentage'],
] as const;

function databasePath(config: RuntimeConfig): string {
  if (config.DATABASE_PATH === ':memory:' || isAbsolute(config.DATABASE_PATH)) {
    return config.DATABASE_PATH;
  }

  return resolve(process.cwd(), config.DATABASE_PATH);
}

function seedDatabase(database: AppDatabase, config: RuntimeConfig): void {
  const now = Date.now();
  const existing = database.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(config.ADMIN_EMAIL) as
    | { id: string; password_hash: string }
    | undefined;

  if (!existing) {
    database.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), config.ADMIN_EMAIL, bcrypt.hashSync(config.ADMIN_PASSWORD, 12), 'Administrator', 'admin', now, now);
  } else if (!bcrypt.compareSync(config.ADMIN_PASSWORD, existing.password_hash)) {
    database.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(bcrypt.hashSync(config.ADMIN_PASSWORD, 12), now, existing.id);
    database.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  }

  const insertConfig = database.prepare(`
    INSERT OR IGNORE INTO site_config (key, value, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const [key, value, description] of defaultConfigs) {
    insertConfig.run(key, value, description, now, now);
  }
}

function migrateDatabase(database: AppDatabase): void {
  const columns = database.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('github_repo')) {
    database.prepare('ALTER TABLE projects ADD COLUMN github_repo TEXT').run();
  }
  if (!columnNames.has('github_stars')) {
    database.prepare('ALTER TABLE projects ADD COLUMN github_stars INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!columnNames.has('github_forks')) {
    database.prepare('ALTER TABLE projects ADD COLUMN github_forks INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!columnNames.has('github_language')) {
    database.prepare('ALTER TABLE projects ADD COLUMN github_language TEXT').run();
  }
  if (!columnNames.has('github_topics')) {
    database.prepare("ALTER TABLE projects ADD COLUMN github_topics TEXT NOT NULL DEFAULT '[]'").run();
  }
  if (!columnNames.has('github_updated_at')) {
    database.prepare('ALTER TABLE projects ADD COLUMN github_updated_at TEXT').run();
  }
  if (!columnNames.has('github_sync_status')) {
    database.prepare("ALTER TABLE projects ADD COLUMN github_sync_status TEXT NOT NULL DEFAULT 'not_synced'").run();
  }
  if (!columnNames.has('github_synced_at')) {
    database.prepare('ALTER TABLE projects ADD COLUMN github_synced_at INTEGER').run();
  }
}

export function initializeDatabase(config: RuntimeConfig): AppDatabase {
  const path = databasePath(config);
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new Database(path);
  try {
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    database.pragma('busy_timeout = 5000');
    database.transaction(() => {
      database.exec(schema);
      migrateDatabase(database);
      if (database.pragma('user_version', { simple: true }) === 0) {
        database.prepare('DELETE FROM sessions').run();
        database.prepare('UPDATE users SET password_hash = ?').run(bcrypt.hashSync(randomBytes(32).toString('hex'), 12));
        database.pragma('user_version = 1');
      }
      seedDatabase(database, config);
    })();
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function closeDatabase(database: AppDatabase): void {
  if (database.open) {
    database.close();
  }
}
