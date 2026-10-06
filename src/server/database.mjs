import pg from 'pg';

// Imported by the server-only Next wrapper and local database tooling only.
export function createDatabase(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL is required. See DATABASE.md.');
  const pool = new pg.Pool({
    connectionString, max: 4, connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000, statement_timeout: 5000,
    application_name: 'workspace-app',
  });
  // Idle disconnections must not crash the app or log credential-bearing errors.
  pool.on('error', () => console.error('Database connection interrupted.'));
  return pool;
}

export async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
