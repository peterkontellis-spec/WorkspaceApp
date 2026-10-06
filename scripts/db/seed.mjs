import { transaction } from '../../src/server/database.mjs';
export const developmentIds = {
  user: 'development-owner',
  workspace: '10000000-0000-4000-8000-000000000001',
  board: '20000000-0000-4000-8000-000000000001',
  group: '30000000-0000-4000-8000-000000000001',
  task: '40000000-0000-4000-8000-000000000001',
};
export async function seedDevelopment(pool) {
  const d = developmentIds;
  await transaction(pool, async (c) => {
    await c.query('INSERT INTO app_user(id, display_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [d.user, 'Development owner (no login)']);
    await c.query('INSERT INTO workspace(id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [d.workspace, 'Development workspace']);
    await c.query('INSERT INTO membership(workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [d.workspace, d.user, 'owner']);
    await c.query('INSERT INTO board(id, workspace_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [d.board, d.workspace, 'Persistence checks']);
    await c.query('INSERT INTO board_group(id, workspace_id, board_id, name) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [d.group, d.workspace, d.board, 'This week']);
    await c.query('INSERT INTO task(id, workspace_id, board_id, group_id, title) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [d.task, d.workspace, d.board, d.group, 'Verify a saved task survives restart']);
  });
}
