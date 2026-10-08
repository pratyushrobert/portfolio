import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const { Pool } = pg;

async function applySchema() {
  console.log('Applying PostgreSQL schema to Supabase...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const schemaSql = readFileSync(resolve(__dirname, '../src/db/schema.sql'), 'utf8');

  try {
    const client = await pool.connect();
    await client.query(schemaSql);
    console.log('Schema applied successfully!');

    // Query tables created in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Public tables now existing:');
    for (const r of tablesRes.rows) {
      console.log(`  - ${r.table_name}`);
    }
    client.release();
  } catch (err) {
    console.error('Failed to apply schema:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applySchema();
