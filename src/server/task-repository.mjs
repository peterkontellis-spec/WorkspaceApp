import { transaction } from './database.mjs';

// actorId must come from a verified server session once HTTP task routes exist.
// This M2.1 repository is only called by local integration checks. Never accept
// actorId or role from request JSON or reuse the prototype account selector.
export async function readTask(pool, workspaceId, taskId, actorId) {
  const result = await pool.query(
    `SELECT t.* FROM task t
    JOIN membership m ON m.workspace_id = t.workspace_id AND m.user_id = $3
    WHERE t.workspace_id = $1 AND t.id = $2`,
    [workspaceId, taskId, actorId],
  );
  return result.rows[0] ?? null;
}

export async function renameTask(pool, { workspaceId, taskId, actorId, revision, title }) {
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.trim().length > 240 ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return { outcome: 'invalid' };
  return transaction(pool, async (c) => {
    // Hold the membership row through commit so revocation and writes serialize.
    const member = (
      await c.query(
        `SELECT role FROM membership
      WHERE workspace_id = $1 AND user_id = $2 FOR SHARE`,
        [workspaceId, actorId],
      )
    ).rows[0];
    if (!member || !['owner', 'editor'].includes(member.role)) return { outcome: 'denied' };
    const result = await c.query(
      `UPDATE task SET title = $4, revision = revision + 1, updated_at = now()
      WHERE workspace_id = $1 AND id = $2 AND revision = $3 RETURNING *`,
      [workspaceId, taskId, revision, title.trim()],
    );
    if (result.rows[0]) return { outcome: 'saved', task: result.rows[0] };
    const exists = await c.query('SELECT 1 FROM task WHERE workspace_id = $1 AND id = $2', [
      workspaceId,
      taskId,
    ]);
    return { outcome: exists.rowCount ? 'conflict' : 'not-found' };
  });
}
