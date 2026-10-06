import { localAuthConfig } from '../auth/config.mjs';
import { writeFile } from 'node:fs/promises';
import { localRoot, openLocalCluster, provisionLocalDatabase, grantApplicationAccess } from './local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from './migrate.mjs';
import { seedDevelopment } from './seed.mjs';

let local;
try {
  await localAuthConfig();
  local = await openLocalCluster();
  await local.cluster.start();
  await provisionLocalDatabase(local);
  const pool = createDatabase(local.adminUrl);
  try {
    const applied = await migrate(pool);
    await seedDevelopment(pool);
    await grantApplicationAccess(pool);
    console.log(`Local PostgreSQL ready on 127.0.0.1:55432. Applied ${applied.length} migration(s).`);
  } finally { await pool.end(); }
  await writeFile(`${localRoot}database.env`, `DATABASE_URL=${local.appUrl}\n`, { mode: 0o600 });
  console.log('Development data stays in .local/postgres. Keep this terminal open; Ctrl+C stops without deleting data.');
  await new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
} catch {
  console.error('Database startup failed. Check that port 55432 is free and this project database is not already running.');
  process.exitCode = 1;
} finally { await local?.cluster.stop(); }

// Preserve failure status: the helper otherwise normalizes beforeExit to zero.
if (process.exitCode) process.exit(process.exitCode);
