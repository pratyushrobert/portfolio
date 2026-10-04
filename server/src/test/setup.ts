import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(import.meta.url);

const TEST_DB_PATH = ':memory:';

let testDb: ReturnType<typeof Database>;

beforeAll(() => {
  // Create in-memory database for tests
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf-8');
  testDb.exec(schema);

  // Create admin user
  const passwordHash = bcrypt.hashSync('mimiisbest@1@', 12);
  const adminId = randomUUID();
  const now = Date.now();

  testDb.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), 'admin@mimios.local', 'mimiisbest@1@', 'Admin', 'admin', now, now);
});

afterAll(() => {
  if (testDb) testDb.close();
});

beforeEach(() => {
  // Clear data between tests but keep schema
  const tables = ['sessions', 'assets', 'certificates', 'experience', 'skills', 'projects', 'portfolio_content', 'site_config', 'sessions', 'users'];
  for (const table of tables) {
    try {
      globalThis.testDb?.prepare(`DELETE FROM ${table}`).run();
    } catch {}
  }
});

afterEach(() => {
  // Cleanup if needed
});

export function getTestDb() {
  return testDb;
}