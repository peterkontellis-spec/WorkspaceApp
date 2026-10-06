import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../../src/server/database.mjs';

export const localRoot = fileURLToPath(new URL('../../.local/', import.meta.url));
export async function openLocalCluster(directory = `${localRoot}postgres`, port = 55432) {
  process.umask(0o077);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await mkdir(`${localRoot}tmp`, { recursive: true, mode: 0o700 });
  // Keep the dependency's temporary initdb password file inside this workspace.
  process.env.TMPDIR = `${localRoot}tmp`;
  const configPath = `${directory}/credentials.json`;
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    config = { adminPassword: randomBytes(32).toString('hex'), appPassword: randomBytes(32).toString('hex') };
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
  }
  const cluster = new EmbeddedPostgres({
    databaseDir: `${directory}/data`, user: 'workspace_local_admin', password: config.adminPassword,
    port, authMethod: 'scram-sha-256', persistent: true, createPostgresUser: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-h', '127.0.0.1', '-k', '', '-c', 'shared_buffers=32MB', '-c', 'max_connections=20'],
    onLog: (message) => { if (/FATAL|PANIC/.test(message)) console.error(message); },
    onError: () => console.error('Local PostgreSQL error; inspect the project database configuration.'),
  });
  // The pinned helper waits forever when stop() sees an already-exited child
  // after a failed start. Keep cleanup bounded without touching other processes.
  const originalStop = cluster.stop.bind(cluster);
  cluster.stop = async () => {
    const child = cluster.process;
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      cluster.process = undefined;
      return;
    }
    await originalStop();
  };
  try { await access(`${directory}/data/PG_VERSION`); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await cluster.initialise();
  }
  const adminUrl = `postgresql://workspace_local_admin:${config.adminPassword}@127.0.0.1:${port}/workspace_development`;
  const appUrl = `postgresql://workspace_app:${config.appPassword}@127.0.0.1:${port}/workspace_development`;
  return { cluster, adminUrl, appUrl, config };
}

export async function provisionLocalDatabase(local) {
  const pool = createDatabase(local.adminUrl.replace('/workspace_development', '/postgres'));
  try {
    if (!(await pool.query("SELECT 1 FROM pg_database WHERE datname = 'workspace_development'")).rowCount) {
      await pool.query('CREATE DATABASE workspace_development');
    }
    if (!(await pool.query("SELECT 1 FROM pg_roles WHERE rolname = 'workspace_app'")).rowCount) {
      // Generated hex-only password, never external input; utility DDL cannot bind parameters.
      if (!/^[a-f0-9]{64}$/.test(local.config.appPassword)) throw new Error('Invalid local credential file.');
      await pool.query(`CREATE ROLE workspace_app LOGIN PASSWORD '${local.config.appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    }
  } finally { await pool.end(); }
}

export async function grantApplicationAccess(pool) {
  await pool.query(`GRANT CONNECT ON DATABASE workspace_development TO workspace_app;
    GRANT USAGE ON SCHEMA public TO workspace_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO workspace_app;
    REVOKE ALL ON schema_migration FROM workspace_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workspace_app;`);
}
