import { loadEnvironment } from '../src/config/env.js';
import { initializeDatabase, closeDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import { createClient } from '@supabase/supabase-js';

async function runLiveVerification() {
  console.log('--- 1. Testing Environment & Database Connection ---');
  const env = loadEnvironment();
  console.log('Database URL configured:', env.DATABASE_URL ? 'YES (Supabase Pooler/Direct)' : 'NO');
  console.log('Supabase URL configured:', env.SUPABASE_URL ? 'YES' : 'NO');
  console.log('Supabase Bucket configured:', env.SUPABASE_STORAGE_BUCKET);

  const database = await initializeDatabase(env);
  console.log('Connected to PostgreSQL successfully.');

  // Test type parsing for int8
  const countRow = await database.queryOne('SELECT COUNT(*) AS total FROM site_config');
  console.log('site_config count:', countRow.total, 'Type:', typeof countRow.total);
  if (typeof countRow.total !== 'number') {
    throw new Error('int8 parser failed: expected number');
  }

  const user = await database.queryOne('SELECT id, email, role, created_at FROM users LIMIT 1');
  console.log('User from DB:', user.email, 'Role:', user.role, 'created_at type:', typeof user.created_at);

  const configRows = await database.queryAll('SELECT key, value FROM site_config WHERE key LIKE $1', ['wallpaper%']);
  console.log(`Wallpaper configs found (${configRows.length} items):`, configRows.map(r => `${r.key}=${r.value}`));

  const assetRows = await database.queryAll('SELECT id, name, asset_path, mime_type, size FROM assets');
  console.log(`Assets in DB (${assetRows.length} items):`);
  for (const a of assetRows) {
    console.log(`  - [${a.name}] path: ${a.asset_path} (${a.mime_type})`);
  }

  console.log('\n--- 2. Testing Supabase Storage Direct Access ---');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  const { data: fileList, error: listErr } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).list();
  if (listErr) {
    throw new Error(`Failed to list bucket contents: ${listErr.message}`);
  }
  console.log(`Files in Supabase bucket '${env.SUPABASE_STORAGE_BUCKET}':`, fileList.map(f => f.name));

  console.log('\n--- 3. Testing Fastify Server Endpoints with Live DB ---');
  const app = await buildApp({ database, config: env });

  // Test /health
  const healthRes = await app.inject({ method: 'GET', url: '/health' });
  console.log('GET /health ->', healthRes.statusCode, healthRes.json());
  if (healthRes.statusCode !== 200 || healthRes.json().status !== 'ok') {
    throw new Error('Health check failed');
  }

  // Test /api/portfolio
  const portfolioRes = await app.inject({ method: 'GET', url: '/api/portfolio' });
  console.log('GET /api/portfolio ->', portfolioRes.statusCode);
  if (portfolioRes.statusCode !== 200) {
    throw new Error('Portfolio fetch failed');
  }
  const portfolioData = portfolioRes.json();
  console.log('  Portfolio content name:', portfolioData.data?.content?.name, '| Tagline:', portfolioData.data?.content?.tagline);
  console.log('  Portfolio items count:', {
    projects: portfolioData.data?.projects?.length,
    skills: portfolioData.data?.skills?.length,
    experience: portfolioData.data?.experience?.length,
    certificates: portfolioData.data?.certificates?.length
  });

  // Test /api/config
  const configRes = await app.inject({ method: 'GET', url: '/api/config' });
  console.log('GET /api/config ->', configRes.statusCode);
  if (configRes.statusCode !== 200) {
    throw new Error('Config fetch failed');
  }
  const configData = configRes.json();
  console.log('  Site title:', configData.data?.site_title, '| Wallpaper URL:', configData.data?.wallpaper_url);

  // Test /api/assets
  const assetsRes = await app.inject({ method: 'GET', url: '/api/assets' });
  console.log('GET /api/assets ->', assetsRes.statusCode);
  const assetsData = assetsRes.json();
  console.log(`  Assets returned: ${assetsData.data?.length}`);

  // Test legacy /uploads/:filename redirect
  if (assetRows.length > 0) {
    const testAsset = assetRows[0];
    const filename = testAsset.asset_path.replace(/^\/uploads\//, '');
    const redirectRes = await app.inject({ method: 'GET', url: `/uploads/${filename}` });
    console.log(`GET /uploads/${filename} -> Status:`, redirectRes.statusCode, 'Location:', redirectRes.headers.location);
    if (redirectRes.statusCode !== 302 || !redirectRes.headers.location?.includes('supabase')) {
      throw new Error(`Legacy uploads redirect failed: expected 302 to Supabase URL, got ${redirectRes.statusCode}`);
    }
  }

  // Test Auth /api/auth/me (unauthenticated)
  const meRes = await app.inject({ method: 'GET', url: '/api/auth/me' });
  console.log('GET /api/auth/me (guest) ->', meRes.statusCode, meRes.json());

  // Test Auth Invalid Login
  const badLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'wrong@example.com', password: 'bad-password-123' },
  });
  console.log('POST /api/auth/login (invalid credentials) ->', badLoginRes.statusCode, badLoginRes.json());
  if (badLoginRes.statusCode !== 401) {
    throw new Error('Auth invalid login should return 401');
  }

  await app.close();
  await closeDatabase(database);
  console.log('\n>>> ALL LIVE SUPABASE POSTGRESQL & STORAGE CHECKS PASSED SUCCESSFULLY! <<<');
}

runLiveVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
