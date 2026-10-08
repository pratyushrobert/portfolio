import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { RuntimeConfig } from '../config/env.js';

// Parse int8 (BIGINT) as JavaScript numbers for timestamps and counts
pg.types.setTypeParser(20, (val) => Number(val));

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export interface DatabaseQueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

export interface AppDatabase {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<DatabaseQueryResult<T>>;
  queryAll<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
  transaction<T>(fn: (tx: AppDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

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
  ['glass_blur', '5', 'Global glass blur radius in pixels (0-30)'],
] as const;

function createClientWrapper(client: pg.PoolClient | pg.Pool): AppDatabase {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<DatabaseQueryResult<T>> {
      const res = await client.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? 0,
      };
    },

    async queryAll<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
      const res = await client.query(sql, params);
      return res.rows as T[];
    },

    async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
      const res = await client.query(sql, params);
      return (res.rows[0] as T) ?? null;
    },

    async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
      const res = await client.query(sql, params);
      return { rowCount: res.rowCount ?? 0 };
    },

    async transaction<T>(fn: (tx: AppDatabase) => Promise<T>): Promise<T> {
      // If this is already a transaction client
      if ('release' in client) {
        return fn(this);
      }

      // If this is a Pool, acquire a client
      const poolClient = await (client as pg.Pool).connect();
      try {
        await poolClient.query('BEGIN');
        const txWrapper = createClientWrapper(poolClient);
        const result = await fn(txWrapper);
        await poolClient.query('COMMIT');
        return result;
      } catch (error) {
        await poolClient.query('ROLLBACK');
        throw error;
      } finally {
        poolClient.release();
      }
    },

    async close(): Promise<void> {
      if ('end' in client) {
        await (client as pg.Pool).end();
      }
    },
  };
}

async function seedDatabase(db: AppDatabase, config: RuntimeConfig): Promise<void> {
  const now = Date.now();
  const existing = await db.queryOne<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [config.ADMIN_EMAIL]
  );

  if (!existing) {
    await db.execute(`
      INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO NOTHING
    `, [randomUUID(), config.ADMIN_EMAIL, bcrypt.hashSync(config.ADMIN_PASSWORD, 12), 'Administrator', 'admin', now, now]);
  } else if (!bcrypt.compareSync(config.ADMIN_PASSWORD, existing.password_hash)) {
    await db.execute(
      'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
      [bcrypt.hashSync(config.ADMIN_PASSWORD, 12), now, existing.id]
    );
    await db.execute('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
  }

  for (const [key, value, description] of defaultConfigs) {
    await db.execute(`
      INSERT INTO site_config (key, value, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (key) DO NOTHING
    `, [key, value, description, now, now]);
  }
}

export async function initializeDatabase(config: RuntimeConfig): Promise<AppDatabase> {
  const isMemory = config.DATABASE_PATH === ':memory:' || (!config.DATABASE_URL && config.NODE_ENV === 'test');

  if (isMemory) {
    const { newDb } = await import('pg-mem');
    const mem = newDb();
    mem.public.none(schema);
    const MemPool = mem.adapters.createPg().Pool;
    const pool = new MemPool();
    const db = createClientWrapper(pool);
    await seedDatabase(db, config);
    return db;
  }

  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for PostgreSQL connection.');
  }

  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const db = createClientWrapper(pool);

  // Apply idempotent schema
  await pool.query(schema);

  // Seed default admin and config
  await seedDatabase(db, config);

  return db;
}

export async function closeDatabase(database: AppDatabase): Promise<void> {
  await database.close();
}
