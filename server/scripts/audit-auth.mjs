import { loadEnvironment } from '../src/config/env.js';
import { initializeDatabase, closeDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';

async function auditAuthentication() {
  const env = loadEnvironment();
  const database = await initializeDatabase(env);
  const app = await buildApp({ database, config: env });

  console.log('--- AUDITING AUTHENTICATION ---');

  // 1. POST /api/auth/login
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    },
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${loginRes.body}`);
  }
  const loginBody = loginRes.json();
  if (!loginBody.success || !loginBody.data?.user) {
    throw new Error('Login body indicates failure or missing user data');
  }
  console.log('✓ POST /api/auth/login: SUCCEEDED (HTTP 200)');

  // Verify Set-Cookie header
  const setCookieHeader = loginRes.headers['set-cookie'];
  if (!setCookieHeader) {
    throw new Error('Missing Set-Cookie header on successful login');
  }
  const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
  const isHttpOnly = /HttpOnly/i.test(cookieString);
  const isSameSite = /SameSite=/i.test(cookieString);
  const hasSessionName = cookieString.includes('mimios_session=');

  if (!isHttpOnly || !hasSessionName) {
    throw new Error(`Cookie attributes validation failed: HttpOnly=${isHttpOnly}, hasSessionName=${hasSessionName}`);
  }
  console.log(`✓ Signed HttpOnly session cookie issued: SUCCEEDED (HttpOnly: ${isHttpOnly}, SameSite: ${isSameSite})`);

  // Extract raw cookie string to pass in request headers
  const rawCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0].split(';')[0] : setCookieHeader.split(';')[0];

  // 2. GET /api/auth/me
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: rawCookie },
  });

  if (meRes.statusCode !== 200) {
    throw new Error(`GET /api/auth/me failed with status ${meRes.statusCode}: ${meRes.body}`);
  }
  const meBody = meRes.json();
  if (!meBody.success || meBody.data?.user?.role !== 'admin') {
    throw new Error(`GET /api/auth/me did not return admin role: ${JSON.stringify(meBody)}`);
  }
  console.log(`✓ GET /api/auth/me returns authenticated admin: SUCCEEDED (Role: ${meBody.data.user.role})`);

  // 3. Authenticated /api/admin endpoint
  const adminRes = await app.inject({
    method: 'GET',
    url: '/api/admin/dashboard',
    headers: { cookie: rawCookie },
  });

  if (adminRes.statusCode !== 200) {
    throw new Error(`GET /api/admin/dashboard failed with status ${adminRes.statusCode}: ${adminRes.body}`);
  }
  const adminBody = adminRes.json();
  if (!adminBody.success) {
    throw new Error('GET /api/admin/dashboard returned non-success response');
  }
  console.log('✓ Authenticated /api/admin/dashboard endpoint: SUCCEEDED (HTTP 200)');

  // 4. POST /api/auth/logout
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { cookie: rawCookie },
  });

  if (logoutRes.statusCode !== 200) {
    throw new Error(`POST /api/auth/logout failed with status ${logoutRes.statusCode}: ${logoutRes.body}`);
  }
  const logoutBody = logoutRes.json();
  if (!logoutBody.success) {
    throw new Error('POST /api/auth/logout returned non-success response');
  }
  const logoutCookie = logoutRes.headers['set-cookie'];
  const isExpired = /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(
    Array.isArray(logoutCookie) ? logoutCookie.join('; ') : String(logoutCookie)
  );
  console.log(`✓ POST /api/auth/logout: SUCCEEDED (Cookie unset: ${isExpired})`);

  // 5. GET /api/auth/me after logout
  const meAfterLogoutRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: rawCookie },
  });

  if (meAfterLogoutRes.statusCode !== 401) {
    throw new Error(`Expected HTTP 401 after logout, got ${meAfterLogoutRes.statusCode}: ${meAfterLogoutRes.body}`);
  }
  const meAfterLogoutBody = meAfterLogoutRes.json();
  if (meAfterLogoutBody.code !== 'UNAUTHENTICATED') {
    throw new Error(`Expected UNAUTHENTICATED code, got ${meAfterLogoutBody.code}`);
  }
  console.log('✓ GET /api/auth/me after logout: SUCCEEDED (HTTP 401 UNAUTHENTICATED)');

  await app.close();
  await closeDatabase(database);
  console.log('\n>>> AUTHENTICATION AUDIT: PASS <<<\n');
}

auditAuthentication().catch((err) => {
  console.error('AUTHENTICATION AUDIT FAILED:', err.message);
  process.exit(1);
});
