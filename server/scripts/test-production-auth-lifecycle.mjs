import { loadEnvironment } from '../src/config/env.js';
import { initializeDatabase, closeDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';

async function testAuthLifecycle() {
  const baseEnv = loadEnvironment();

  console.log('=== TEST 1: PRODUCTION CROSS-ORIGIN AUTH LIFECYCLE ===');
  console.log('Simulating Frontend: https://mimios.onrender.com -> Backend: https://mimios-api.onrender.com');

  const prodConfig = {
    ...baseEnv,
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://mimios.onrender.com,http://localhost:5173',
  };

  const database = await initializeDatabase(prodConfig);
  const app = await buildApp({ database, config: prodConfig });

  const origin = 'https://mimios.onrender.com';

  // 1. POST /api/auth/login
  console.log('\n1. Sending POST /api/auth/login with Origin:', origin);
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin },
    payload: {
      email: prodConfig.ADMIN_EMAIL,
      password: prodConfig.ADMIN_PASSWORD,
    },
  });

  console.log('   Status:', loginRes.statusCode);
  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${loginRes.body}`);
  }

  // Verify CORS headers
  console.log('   Access-Control-Allow-Origin:', loginRes.headers['access-control-allow-origin']);
  console.log('   Access-Control-Allow-Credentials:', loginRes.headers['access-control-allow-credentials']);
  if (loginRes.headers['access-control-allow-origin'] !== origin) {
    throw new Error(`Expected CORS origin ${origin}, got ${loginRes.headers['access-control-allow-origin']}`);
  }
  if (loginRes.headers['access-control-allow-credentials'] !== 'true') {
    throw new Error('Expected Access-Control-Allow-Credentials: true');
  }

  // Verify Set-Cookie header
  const setCookieHeader = String(loginRes.headers['set-cookie'] || '');
  console.log('   Set-Cookie attributes:');
  const hasHttpOnly = /HttpOnly/i.test(setCookieHeader);
  const hasSecure = /Secure/i.test(setCookieHeader);
  const hasSameSiteNone = /SameSite=None/i.test(setCookieHeader);
  const hasPath = /Path=\//i.test(setCookieHeader);
  const hasSessionCookie = setCookieHeader.includes('mimios_session=');

  console.log('   - HttpOnly:', hasHttpOnly);
  console.log('   - Secure:', hasSecure);
  console.log('   - SameSite=None:', hasSameSiteNone);
  console.log('   - Path=/ :', hasPath);
  console.log('   - Signed mimios_session:', hasSessionCookie);

  if (!hasHttpOnly || !hasSecure || !hasSameSiteNone || !hasPath || !hasSessionCookie) {
    throw new Error(`Cookie attributes missing required cross-origin production flags! Header: ${setCookieHeader}`);
  }

  // Extract raw cookie for subsequent requests
  const rawCookie = setCookieHeader.split(';')[0];

  // 2. GET /api/auth/me with Cookie
  console.log('\n2. Sending GET /api/auth/me with stored cookie...');
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { origin, cookie: rawCookie },
  });

  console.log('   Status:', meRes.statusCode);
  const meData = meRes.json();
  console.log('   User Role:', meData.data?.user?.role, '| Email:', meData.data?.user?.email);
  if (meRes.statusCode !== 200 || meData.data?.user?.role !== 'admin') {
    throw new Error(`GET /api/auth/me failed! Expected 200 OK with admin role, got ${meRes.statusCode}: ${meRes.body}`);
  }

  // 3. GET /api/admin/dashboard
  console.log('\n3. Sending GET /api/admin/dashboard with stored cookie...');
  const adminRes = await app.inject({
    method: 'GET',
    url: '/api/admin/dashboard',
    headers: { origin, cookie: rawCookie },
  });
  console.log('   Status:', adminRes.statusCode);
  if (adminRes.statusCode !== 200) {
    throw new Error(`Admin dashboard failed with status ${adminRes.statusCode}`);
  }

  // 4. POST /api/auth/logout
  console.log('\n4. Sending POST /api/auth/logout...');
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { origin, cookie: rawCookie },
  });
  console.log('   Status:', logoutRes.statusCode);
  const logoutCookie = String(logoutRes.headers['set-cookie'] || '');
  const clearHasSameSiteNone = /SameSite=None/i.test(logoutCookie);
  const clearHasSecure = /Secure/i.test(logoutCookie);
  const clearHasExpired = /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(logoutCookie);
  console.log('   Logout Cookie attributes:');
  console.log('   - Expired (Max-Age=0 / 1970):', clearHasExpired);
  console.log('   - SameSite=None:', clearHasSameSiteNone);
  console.log('   - Secure:', clearHasSecure);

  if (!clearHasExpired || !clearHasSameSiteNone || !clearHasSecure) {
    throw new Error(`Logout Set-Cookie header does not match production attributes: ${logoutCookie}`);
  }

  // 5. GET /api/auth/me after logout
  console.log('\n5. Sending GET /api/auth/me after logout (should be 401)...');
  const meAfterLogoutRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { origin, cookie: rawCookie },
  });
  console.log('   Status:', meAfterLogoutRes.statusCode);
  console.log('   Response Code:', meAfterLogoutRes.json().code);
  if (meAfterLogoutRes.statusCode !== 401) {
    throw new Error(`Expected 401 after logout, got ${meAfterLogoutRes.statusCode}`);
  }

  await app.close();
  await closeDatabase(database);
  console.log('\n>>> PRODUCTION CROSS-ORIGIN AUTH LIFECYCLE: ALL CHECKS PASSED <<<\n');
}

testAuthLifecycle().catch((err) => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
