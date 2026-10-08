import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const { Pool } = pg;

async function inspect() {
  console.log('=== INSPECTING SUPABASE POSTGRESQL ===');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    const dbInfo = await client.query('SELECT current_database(), current_schema(), version()');
    console.log('Database:', dbInfo.rows[0].current_database);
    console.log('Default schema:', dbInfo.rows[0].current_schema);
    console.log('Version:', dbInfo.rows[0].version.split(' on ')[0]);

    const tablesRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY table_schema, table_name
    `);
    console.log('\nExisting tables in non-system schemas:');
    if (tablesRes.rows.length === 0) {
      console.log('  (None found - empty database)');
    } else {
      for (const row of tablesRes.rows) {
        console.log(`  - [${row.table_schema}] ${row.table_name}`);
      }
    }
    client.release();
  } catch (err) {
    console.error('PostgreSQL inspect error:', err.message);
  } finally {
    await pool.end();
  }

  console.log('\n=== INSPECTING SUPABASE STORAGE ===');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        console.error('Storage buckets list error:', error.message);
      } else {
        console.log('Existing storage buckets:');
        if (!buckets || buckets.length === 0) {
          console.log('  (None found)');
        } else {
          for (const b of buckets) {
            console.log(`  - ${b.name} (public: ${b.public}, id: ${b.id})`);
          }
        }
      }
    } catch (err) {
      console.error('Supabase client error:', err.message);
    }
  } else {
    console.log('SUPABASE_URL or SUPABASE_SECRET_KEY not set.');
  }
}

inspect();
