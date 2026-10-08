import { loadEnvironment } from '../src/config/env.js';
import { initializeDatabase, closeDatabase } from '../src/db/index.js';

async function auditBigInt() {
  const env = loadEnvironment();
  const db = await initializeDatabase(env);

  console.log('--- AUDITING BIGINT / INT8 COLUMNS ---');
  console.log(`Number.MAX_SAFE_INTEGER = ${Number.MAX_SAFE_INTEGER} (~9.007 × 10^15)`);

  const columns = await db.queryAll(`
    SELECT table_name, column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'bigint'
    ORDER BY table_name, column_name;
  `);

  console.log(`\nFound ${columns.length} BIGINT column(s) in public schema:`);
  for (const c of columns) {
    console.log(`- ${c.table_name}.${c.column_name} (${c.data_type})`);
  }

  console.log('\nChecking current maximum values in each table:');
  for (const c of columns) {
    try {
      const maxRow = await db.queryOne(`SELECT MAX(${c.column_name}) AS max_val FROM ${c.table_name}`);
      const maxVal = maxRow?.max_val;
      const isSafe = maxVal === null || maxVal === undefined || (typeof maxVal === 'number' && maxVal <= Number.MAX_SAFE_INTEGER);
      console.log(`  * ${c.table_name}.${c.column_name}: MAX = ${maxVal} (Safe: ${isSafe})`);
    } catch (e) {
      console.log(`  * ${c.table_name}.${c.column_name}: Query error: ${e.message}`);
    }
  }

  await closeDatabase(db);
  console.log('\n>>> BIGINT AUDIT COMPLETE <<<');
}

auditBigInt().catch((err) => {
  console.error('BIGINT AUDIT FAILED:', err.message);
  process.exit(1);
});
