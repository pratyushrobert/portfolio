import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = env.DATABASE_PATH;

const syncDb = new Database(DB_PATH);
syncDb.pragma('journal_mode = WAL');
syncDb.pragma('foreign_keys = ON');

const syncDbInstance = new Database(DB_PATH);
syncDbInstance.pragma('journal_mode = WAL');
syncDbInstance.pragma('foreign_keys = ON');

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
syncDbInstance.exec(schema);

// Ensure admin user exists
const adminEmail = process.env.ADMIN_EMAIL || 'admin@mimios.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'mimiisbest@1@';

const existing = syncDbInstance.prepare('SELECT id FROM users WHERE email = ?').get('admin@mimios.local');
if (!existing) {
  const passwordHash = bcrypt.hashSync('mimiisbest@1@', 12);
  const adminId = randomUUID();
  const now = Date.now();

  syncDbInstance.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), 'admin@mimios.local', bcrypt.hashSync('mimiisbest@1@', 12), 'Admin', 'admin', Date.now(), Date.now());

  console.log('Created default admin user: admin@mimios.local');
}

// Ensure default site config exists
const defaultConfigs = [
  { key: 'site_name', value: 'MimiOS Portfolio', description: 'Site name displayed in header' },
  { key: 'site_title', value: 'Full-stack Developer', description: 'Short title' },
  { key: 'site_description', value: 'Building creative web experiences', description: 'Short description for SEO' },
  { key: 'site_keywords', value: 'React, TypeScript, Node.js, Python, Go, Portfolio', description: 'SEO keywords' },
  { key: 'contact_email', value: 'pratyush@example.com', description: 'Contact email' },
  { key: 'contact_github', value: 'https://github.com/pratyush', description: 'GitHub profile' },
  { key: 'contact_linkedin', value: 'https://linkedin.com/in/pratyush', description: 'LinkedIn profile' },
  { key: 'contact_website', value: 'https://pratyush.dev', description: 'Personal website' },
  { key: 'wallpaper_url', value: '', description: 'Desktop wallpaper URL' },
  { key: 'wallpaper_position', value: 'center', description: 'Wallpaper position' },
  { key: 'wallpaper_size', value: 'cover', description: 'Wallpaper size' },
  { key: 'wallpaper_overlay', value: 'rgba(0, 0, 0, 0.3)', description: 'Wallpaper overlay' },
  { key: 'wallpaper_color', value: '#1a1a2e', description: 'Wallpaper fallback color' },
];

const insertConfig = syncDb.prepare(`
  INSERT OR IGNORE INTO site_config (key, value, description, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`);

const now = Date.now();
for (const config of defaultConfigs) {
  insertConfig.run(config.key, config.value, config.description, now, now);
}

export const db = {
  get: (sql: string, ...params: unknown[]) => syncDb.prepare(sql).get(...params),
  all: (sql: string, ...params: unknown[]) => syncDb.prepare(sql).all(...params),
  run: (sql: string, ...params: unknown[]) => syncDb.prepare(sql).run(...params),
  exec: (sql: string) => syncDb.exec(sql),
  prepare: (sql: string) => syncDb.prepare(sql),
  pragma: (pragma: string) => syncDb.pragma(pragma),
};

export async function initializeDatabase(): Promise<void> {
  // Already initialized synchronously
}

export function getDb() {
  return db;
}

export function closeDb(): void {
  // Database is synchronous, no close needed for better-sqlite3
}