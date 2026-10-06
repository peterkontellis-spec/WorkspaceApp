import 'server-only';
import type { Pool } from 'pg';
import { createDatabase } from './database.mjs';
const globalDatabase = globalThis as typeof globalThis & { workspaceDatabase?: Pool };
export function getDatabase(): Pool {
  if (!globalDatabase.workspaceDatabase) {
    globalDatabase.workspaceDatabase = createDatabase(process.env.DATABASE_URL);
  }
  return globalDatabase.workspaceDatabase;
}
