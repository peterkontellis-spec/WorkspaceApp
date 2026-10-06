import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transaction } from '../../src/server/database.mjs';

export const migrationsDirectory = fileURLToPath(new URL('../../database/migrations/', import.meta.url));
export async function migrate(pool, directory = migrationsDirectory) {
  const names = (await readdir(directory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  const files = await Promise.all(names.map(async (name) => {
    const sql = await readFile(`${directory}/${name}`, 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
  return transaction(pool, async (client) => {
    // Serialize migrations from concurrent app/tool starts in this database.
    await client.query('SELECT pg_advisory_xact_lock(73021001)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migration (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = (await client.query('SELECT name, checksum FROM schema_migration ORDER BY name')).rows;
    for (let i = 0; i < applied.length; i++) {
      if (files[i]?.name !== applied[i].name || files[i]?.checksum !== applied[i].checksum) {
        throw new Error('Migration history differs from this build. Restore matching migration files; never edit applied migrations.');
      }
    }
    const pending = files.slice(applied.length);
    for (const file of pending) {
      await client.query(file.sql);
      await client.query('INSERT INTO schema_migration(name, checksum) VALUES ($1, $2)', [file.name, file.checksum]);
    }
    return pending.map((file) => file.name);
  });
}
