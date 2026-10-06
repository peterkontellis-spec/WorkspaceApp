import { getMigrations } from 'better-auth/db/migration';
import { writeFile } from 'node:fs/promises';
import { createDatabase } from '../../src/server/database.mjs';
import { authOptions } from '../../src/server/auth-core.mjs';
import { localAuthConfig, root } from './config.mjs';
// This uses the live development database only to compare schema; it does not apply changes.
const { AUTH_SECRET, AUTH_BASE_URL } = await localAuthConfig();
const { readFile } = await import('node:fs/promises');
const credentials = JSON.parse(await readFile(`${root}.local/postgres/credentials.json`, 'utf8'));
const pool = createDatabase(`postgresql://workspace_local_admin:${credentials.adminPassword}@127.0.0.1:55432/workspace_development`);
try {
  const migration = await getMigrations(authOptions(pool, { secret: AUTH_SECRET, baseURL: AUTH_BASE_URL }));
  await writeFile(`${root}database/migrations/003_authentication.sql`, '-- Generated from Better Auth 1.7.7 and authOptions; reviewed before application.\n'+await migration.compileMigrations()+'\n', { flag: 'wx' });
  console.log('Authentication schema generated for review; no schema changes applied.');
} finally { await pool.end(); }
