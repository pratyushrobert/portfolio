import { loadEnvironment } from '../src/config/env.js';
import { initializeDatabase, closeDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';

async function testPersistence() {
  console.log('--- STARTING PERSISTENCE TEST ---');
  const env = loadEnvironment();

  // STEP 1: Start Backend Instance #1 & Read Current site_config
  console.log('1. Starting Backend Instance #1...');
  let db1 = await initializeDatabase(env);
  let app1 = await buildApp({ database: db1, config: env });

  const initialRes = await app1.inject({ method: 'GET', url: '/api/config' });
  if (initialRes.statusCode !== 200) {
    throw new Error(`Failed to read config: ${initialRes.statusCode}`);
  }
  const initialConfig = initialRes.json().data;
  console.log('Current site_config read successfully. Keys count:', Object.keys(initialConfig).length);
  const testKey = 'wallpaper_brightness';
  const originalValue = initialConfig[testKey] ?? '100';
  console.log(`Original value for '${testKey}':`, originalValue);

  // STEP 2: Update one safe development configuration value
  const testValue = originalValue === '99' ? '98' : '99';
  console.log(`2. Updating '${testKey}' to '${testValue}' in PostgreSQL...`);
  await db1.execute(
    'UPDATE site_config SET value = $1, updated_at = $2 WHERE key = $3',
    [testValue, Date.now(), testKey]
  );

  // STEP 3: Read it back from Instance #1
  console.log('3. Reading back updated value from Instance #1...');
  const verifyRes1 = await app1.inject({ method: 'GET', url: '/api/config' });
  const readBackValue1 = verifyRes1.json().data[testKey];
  console.log(`Read back value from Instance #1: '${readBackValue1}'`);
  if (readBackValue1 !== testValue) {
    throw new Error(`Immediate read-back failed: expected '${testValue}', got '${readBackValue1}'`);
  }

  // STEP 4: Restart the backend (destroy app1 & db1, create new db2 & app2)
  console.log('4. Restarting backend: closing Instance #1 and connection pool...');
  await app1.close();
  await closeDatabase(db1);
  console.log('Instance #1 terminated cleanly.');

  console.log('Starting fresh Backend Instance #2 with new connection pool...');
  const db2 = await initializeDatabase(env);
  const app2 = await buildApp({ database: db2, config: env });

  // STEP 5: Read it again from Instance #2
  console.log('5. Reading value again from fresh Instance #2...');
  const verifyRes2 = await app2.inject({ method: 'GET', url: '/api/config' });
  const readBackValue2 = verifyRes2.json().data[testKey];
  console.log(`Read back value from Instance #2: '${readBackValue2}'`);

  // STEP 6: Verify persistence
  if (readBackValue2 !== testValue) {
    throw new Error(`Persistence verification failed: expected '${testValue}', got '${readBackValue2}'`);
  }
  console.log(`✓ Value '${readBackValue2}' successfully persisted across server restart!`);

  // STEP 7: Restore original value so production data is untouched
  console.log(`7. Restoring '${testKey}' back to original value '${originalValue}'...`);
  await db2.execute(
    'UPDATE site_config SET value = $1, updated_at = $2 WHERE key = $3',
    [originalValue, Date.now(), testKey]
  );

  const finalRes = await app2.inject({ method: 'GET', url: '/api/config' });
  const finalValue = finalRes.json().data[testKey];
  console.log(`Confirmed restored value: '${finalValue}'`);

  await app2.close();
  await closeDatabase(db2);
  console.log('\n>>> PERSISTENCE TEST: PASS <<<\n');
}

testPersistence().catch((err) => {
  console.error('PERSISTENCE TEST FAILED:', err.message);
  process.exit(1);
});
