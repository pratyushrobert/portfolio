import Database from 'better-sqlite3';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const { Pool } = pg;

async function migrate() {
  console.log('=== STARTING SQLITE TO SUPABASE MIGRATION ===');
  const sqlitePath = resolve(__dirname, '../data/mimios.db');
  if (!existsSync(sqlitePath)) {
    console.log('No local SQLite database found at data/mimios.db. Skipping data migration.');
    return;
  }

  const sqlite = new Database(sqlitePath, { readonly: true });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
    : null;

  const pgClient = await pool.connect();

  try {
    // 1. Users
    const users = sqlite.prepare('SELECT id, email, password_hash, name, role, created_at, updated_at FROM users').all();
    console.log(`Found ${users.length} user(s) in SQLite.`);
    for (const u of users) {
      await pgClient.query(`
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name,
          updated_at = EXCLUDED.updated_at
      `, [u.id, u.email, u.password_hash, u.name, u.role, u.created_at, u.updated_at]);
    }
    console.log('✓ Users migrated successfully.');

    // 2. Site Config
    const configs = sqlite.prepare('SELECT key, value, description, created_at, updated_at FROM site_config').all();
    console.log(`Found ${configs.length} site_config item(s) in SQLite.`);
    for (const c of configs) {
      await pgClient.query(`
        INSERT INTO site_config (key, value, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          description = EXCLUDED.description,
          updated_at = EXCLUDED.updated_at
      `, [c.key, c.value, c.description, c.created_at, c.updated_at]);
    }
    console.log('✓ Site configuration migrated successfully.');

    // 3. Portfolio Content
    const portfolioContent = sqlite.prepare('SELECT id, key, content, created_at, updated_at FROM portfolio_content').all();
    console.log(`Found ${portfolioContent.length} portfolio_content item(s) in SQLite.`);
    for (const p of portfolioContent) {
      await pgClient.query(`
        INSERT INTO portfolio_content (id, key, content, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (key) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = EXCLUDED.updated_at
      `, [p.id, p.key, p.content, p.created_at, p.updated_at]);
    }
    console.log('✓ Portfolio content migrated successfully.');

    // 4. Projects
    const projects = sqlite.prepare('SELECT * FROM projects').all();
    console.log(`Found ${projects.length} project(s) in SQLite.`);
    for (const pr of projects) {
      await pgClient.query(`
        INSERT INTO projects (
          id, name, description, long_description, technologies, github_url, live_url,
          featured_image, visibility, featured, sort_order, github_repo, github_stars,
          github_forks, github_language, github_topics, github_updated_at, github_sync_status,
          github_synced_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          updated_at = EXCLUDED.updated_at
      `, [
        pr.id, pr.name, pr.description, pr.long_description, pr.technologies, pr.github_url, pr.live_url,
        pr.featured_image, pr.visibility, pr.featured, pr.sort_order, pr.github_repo, pr.github_stars,
        pr.github_forks, pr.github_language, pr.github_topics, pr.github_updated_at, pr.github_sync_status,
        pr.github_synced_at, pr.created_at, pr.updated_at
      ]);
    }
    console.log('✓ Projects migrated successfully.');

    // 5. Skills
    const skills = sqlite.prepare('SELECT * FROM skills').all();
    console.log(`Found ${skills.length} skill(s) in SQLite.`);
    for (const s of skills) {
      await pgClient.query(`
        INSERT INTO skills (id, name, category, level, sort_order, visibility, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [s.id, s.name, s.category, s.level, s.sort_order, s.visibility, s.created_at, s.updated_at]);
    }
    console.log('✓ Skills migrated successfully.');

    // 6. Experience
    const experiences = sqlite.prepare('SELECT * FROM experience').all();
    console.log(`Found ${experiences.length} experience item(s) in SQLite.`);
    for (const e of experiences) {
      await pgClient.query(`
        INSERT INTO experience (id, organization, role, start_date, end_date, description, technologies, link, sort_order, visibility, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [e.id, e.organization, e.role, e.start_date, e.end_date, e.description, e.technologies, e.link, e.sort_order, e.visibility, e.created_at, e.updated_at]);
    }
    console.log('✓ Experience items migrated successfully.');

    // 7. Assets
    const assets = sqlite.prepare('SELECT * FROM assets').all();
    console.log(`Found ${assets.length} asset(s) in SQLite.`);
    for (const a of assets) {
      await pgClient.query(`
        INSERT INTO assets (id, name, category, asset_path, mime_type, size, featured, visibility, tags, sort_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [a.id, a.name, a.category, a.asset_path, a.mime_type, a.size, a.featured, a.visibility, a.tags, a.sort_order, a.created_at, a.updated_at]);
    }
    console.log('✓ Assets table migrated successfully.');

    // 8. Certificates
    const certificates = sqlite.prepare('SELECT * FROM certificates').all();
    console.log(`Found ${certificates.length} certificate(s) in SQLite.`);
    for (const c of certificates) {
      await pgClient.query(`
        INSERT INTO certificates (id, name, issuer, date, description, asset_id, link, sort_order, visibility, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [c.id, c.name, c.issuer, c.date, c.description, c.asset_id, c.link, c.sort_order, c.visibility, c.created_at, c.updated_at]);
    }
    console.log('✓ Certificates migrated successfully.');

    // 9. Upload physical asset files to Supabase Storage
    if (supabase) {
      console.log('\n--- Migrating physical asset files to Supabase Storage ---');
      for (const a of assets) {
        const localFilePath = resolve(__dirname, '../uploads', a.asset_path);
        if (existsSync(localFilePath)) {
          const fileBuffer = readFileSync(localFilePath);
          const { error: uploadError } = await supabase.storage
            .from('mimios-assets')
            .upload(a.asset_path, fileBuffer, {
              contentType: a.mime_type,
              upsert: true,
            });
          if (uploadError) {
            console.error(`  Failed to upload ${a.asset_path}:`, uploadError.message);
          } else {
            console.log(`  ✓ Uploaded ${a.asset_path} (${a.name}) to Supabase Storage.`);
          }
        } else {
          console.log(`  File ${a.asset_path} not found locally in uploads/`);
        }
      }
    }

    // 10. Record count verification in PostgreSQL
    console.log('\n=== VERIFYING POSTGRESQL RECORD COUNTS ===');
    const tables = ['users', 'site_config', 'portfolio_content', 'projects', 'skills', 'experience', 'assets', 'certificates'];
    for (const tbl of tables) {
      const res = await pgClient.query(`SELECT COUNT(*) as count FROM ${tbl}`);
      console.log(`  - ${tbl}: ${res.rows[0].count} records`);
    }

  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    sqlite.close();
    pgClient.release();
    await pool.end();
  }
  console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===');
}

migrate().catch(console.error);
