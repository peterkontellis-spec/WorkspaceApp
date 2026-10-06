import { readFile } from 'node:fs/promises';
import { localRoot, grantApplicationAccess } from './local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from './migrate.mjs';
import { seedDevelopment } from './seed.mjs';

// Deliberately limited to this project's development database. Production schema
// operations require a separate release procedure, not this development helper.
const config = JSON.parse(await readFile(`${localRoot}postgres/credentials.json`, 'utf8'));
const pool = createDatabase(`postgresql://workspace_local_admin:${config.adminPassword}@127.0.0.1:55432/workspace_development`);
try {
  if (process.argv[2] === 'migrate') { console.log({ applied: await migrate(pool) }); await grantApplicationAccess(pool); }
  else if (process.argv[2] === 'seed') { await seedDevelopment(pool); console.log('Development records available; existing edits preserved.'); }
  else if (process.argv[2] === 'status') {
    console.log((await pool.query('SELECT name, applied_at FROM schema_migration ORDER BY name')).rows);
    console.log((await pool.query('SELECT count(*)::integer AS tasks FROM task')).rows[0]);
  } else throw new Error('Use migrate, seed or status.');
} finally { await pool.end(); }
