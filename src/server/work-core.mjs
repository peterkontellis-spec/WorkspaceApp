import { transaction } from './database.mjs';

export class WorkError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new WorkError(status, message); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = value => { if (typeof value !== 'string' || !uuid.test(value)) fail(400, 'Choose a valid item.'); return value; };
const text = (value, max, optional = false) => {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail(400, `Enter text of ${optional ? '0' : '1'}–${max} characters.`);
  return value.trim();
};
const integer = value => { if (!Number.isInteger(value) || value < 0 || value > 2147483646) fail(400, 'Choose a valid position.'); return value; };
const revision = value => { if (!Number.isInteger(value) || value < 1 || value > 2147483646) fail(400, 'Reload this item before saving.'); return value; };
const date = value => {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) fail(400, 'Choose a valid date.');
  return value;
};
const choice = (value, values) => { if (!values.includes(value)) fail(400, 'Choose a valid value.'); return value; };
const object = value => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Invalid request.'); return value; };
const keys = (value, allowed) => { if (Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'This field is not available for editing.'); };

async function liveMember(c, session, workspaceId) {
  const member = (await c.query(`SELECT u.id,u.display_name AS name,m.workspace_id,m.role FROM app_user u
    JOIN membership m ON m.user_id=u.id JOIN auth_session s ON s."userId"=u.auth_user_id
    WHERE u.auth_user_id=$1 AND s.id=$2 AND u.disabled_at IS NULL AND s."expiresAt">now()
    AND s."updatedAt">now()-interval '30 minutes' AND ($3::uuid IS NULL OR m.workspace_id=$3)
    ORDER BY m.workspace_id LIMIT 1`, [session.user.id, session.session.id, workspaceId ?? null])).rows[0];
  if (!member) fail(401, 'Sign in required.');
  return member;
}
async function withMember(pool, auth, headers, write, action) {
  const session = await auth.api.getSession({ headers });
  if (!session) fail(401, 'Sign in required.');
  return transaction(pool, async c => {
    const initial = await liveMember(c, session);
    // The same workspace lock used by membership mutations makes role revocation
    // authoritative before writes, including requests handled by another worker.
    await c.query(`SELECT id FROM workspace WHERE id=$1 FOR ${write ? 'UPDATE' : 'SHARE'}`, [initial.workspace_id]);
    const member = await liveMember(c, session, initial.workspace_id);
    if (write && !['owner', 'editor'].includes(member.role)) fail(403, 'Only owners and editors can change workspace work.');
    const result = await action(c, member);
    if (write) await c.query('UPDATE auth_session SET "updatedAt"=now() WHERE id=$1', [session.session.id]);
    return result;
  });
}
async function snapshot(c, member) {
  const workspace = [member.workspace_id];
  const boards = (await c.query('SELECT id,name,description,revision FROM board WHERE workspace_id=$1 ORDER BY created_at,id', workspace)).rows;
  const groups = (await c.query('SELECT id,board_id AS "boardId",name,position,revision FROM board_group WHERE workspace_id=$1 ORDER BY position,id', workspace)).rows;
  const tasks = (await c.query(`SELECT t.id,t.board_id AS "boardId",t.group_id AS "groupId",t.parent_id AS "parentId",t.title,t.status,t.priority,
    to_char(t.due_date,'YYYY-MM-DD') AS "dueDate",t.position,t.revision,
    ARRAY(SELECT a.user_id FROM task_assignee a WHERE a.workspace_id=t.workspace_id AND a.task_id=t.id ORDER BY a.user_id) AS "assigneeIds"
    FROM task t WHERE t.workspace_id=$1 ORDER BY t.position,t.id`, workspace)).rows;
  const members = (await c.query(`SELECT u.id,u.display_name AS name,a.email,m.role FROM membership m
    JOIN app_user u ON u.id=m.user_id JOIN auth_user a ON a.id=u.auth_user_id
    WHERE m.workspace_id=$1 AND u.disabled_at IS NULL ORDER BY u.display_name,u.id`, workspace)).rows;
  return { boards, groups, tasks, members, actor: { id: member.id, name: member.name, role: member.role } };
}
export function readWork(pool, auth, headers) { return withMember(pool, auth, headers, false, snapshot); }
async function row(c, table, workspace, itemId) {
  const result = (await c.query(`SELECT * FROM ${table} WHERE workspace_id=$1 AND id=$2`, [workspace, id(itemId)])).rows[0];
  if (!result) fail(404, 'Item not found.');
  return result;
}
const checkRevision = (saved, expected) => { if (saved.revision !== revision(expected)) fail(409, 'Someone changed this item. Reload the latest version before saving again.'); };
async function nextPosition(c, table, workspace, board) {
  const n = (await c.query(`SELECT coalesce(max(position),-1)+1 AS n FROM ${table} WHERE workspace_id=$1 AND board_id=$2`, [workspace, board])).rows[0].n;
  return integer(n);
}
async function taskValues(c, workspace, board, taskId, patch, current = {}) {
  object(patch); keys(patch, ['title', 'groupId', 'parentId', 'status', 'priority', 'dueDate', 'position', 'assigneeIds']);
  const value = { ...current };
  if ('title' in patch) value.title = text(patch.title, 240);
  if ('status' in patch) value.status = choice(patch.status, ['To do', 'In progress', 'Done']);
  if ('priority' in patch) value.priority = choice(patch.priority, ['Low', 'Medium', 'High']);
  if ('dueDate' in patch) value.due_date = date(patch.dueDate);
  if ('position' in patch) value.position = integer(patch.position);
  if ('groupId' in patch) {
    const group = await row(c, 'board_group', workspace, patch.groupId);
    if (group.board_id !== board) fail(400, 'The group must belong to this board.');
    value.group_id = group.id;
  }
  if ('parentId' in patch) {
    value.parent_id = patch.parentId === null ? null : id(patch.parentId);
    if (value.parent_id !== null) {
      const parent = await row(c, 'task', workspace, value.parent_id);
      if (parent.board_id !== board) fail(400, 'The parent task must belong to this board.');
      if (taskId) {
        const cycle = await c.query(`WITH RECURSIVE ancestors AS (
          SELECT id,parent_id FROM task WHERE workspace_id=$1 AND id=$2
          UNION SELECT t.id,t.parent_id FROM task t JOIN ancestors a ON t.id=a.parent_id WHERE t.workspace_id=$1
        ) SELECT 1 FROM ancestors WHERE id=$3`, [workspace, parent.id, taskId]);
        if (cycle.rowCount) fail(400, 'A task cannot be its own ancestor.');
      }
    }
  }
  if ('assigneeIds' in patch) {
    if (!Array.isArray(patch.assigneeIds) || patch.assigneeIds.length > 4 || patch.assigneeIds.some(x => typeof x !== 'string' || !x || x.length > 128) || new Set(patch.assigneeIds).size !== patch.assigneeIds.length) fail(400, 'Choose up to four distinct workspace members.');
    const members = await c.query(`SELECT m.user_id FROM membership m JOIN app_user u ON u.id=m.user_id
      WHERE m.workspace_id=$1 AND m.user_id=ANY($2::text[]) AND u.disabled_at IS NULL`, [workspace, patch.assigneeIds]);
    if (members.rowCount !== patch.assigneeIds.length) fail(400, 'Assignees must be active workspace members.');
    value.assigneeIds = patch.assigneeIds;
  }
  return value;
}
async function assignments(c, workspace, task, values) {
  if (!('assigneeIds' in values)) return;
  await c.query('DELETE FROM task_assignee WHERE workspace_id=$1 AND task_id=$2', [workspace, task]);
  for (const member of values.assigneeIds) await c.query('INSERT INTO task_assignee(workspace_id,task_id,user_id) VALUES($1,$2,$3)', [workspace, task, member]);
}
// The entity UUID is also the bounded retry key: no extra key ledger or expiry.
// A successful retry returns current state and never replays the original fields.
async function creation(c, table, workspace, value) {
  if (value === undefined) return { id: null, exists: false };
  const creationId = id(value);
  const saved = (await c.query(`SELECT workspace_id FROM ${table} WHERE id=$1`, [creationId])).rows[0];
  if (saved && saved.workspace_id !== workspace) fail(409, 'This creation identifier is unavailable. Start a new item.');
  return { id: creationId, exists: Boolean(saved) };
}
const inserted = row => {
  // Different workspaces use different locks, so a concurrent UUID collision
  // must also be rejected by the table's primary key without exposing its row.
  if (!row) fail(409, 'This creation identifier is unavailable. Start a new item.');
  return row;
};
export function manageWork(pool, auth, headers, input) {
  return withMember(pool, auth, headers, true, async (c, member) => {
    object(input);
    const workspace = member.workspace_id;
    if (input.action === 'createBoard') {
      keys(input, ['action', 'name', 'description', 'creationId']);
      const create = await creation(c, 'board', workspace, input.creationId);
      if (create.exists) return snapshot(c, member);
      const board = inserted((await c.query('INSERT INTO board(id,workspace_id,name,description) VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id', [create.id, workspace, text(input.name, 120), text(input.description ?? '', 4000, true)])).rows[0]);
      await c.query("INSERT INTO board_group(workspace_id,board_id,name) VALUES($1,$2,'Tasks')", [workspace, board.id]);
    } else if (input.action === 'updateBoard') {
      keys(input, ['action', 'id', 'revision', 'name', 'description']);
      const saved = await row(c, 'board', workspace, input.id); checkRevision(saved, input.revision);
      await c.query('UPDATE board SET name=$3,description=$4,revision=revision+1 WHERE workspace_id=$1 AND id=$2 AND revision=$5', [workspace, saved.id, text(input.name ?? saved.name, 120), text(input.description ?? saved.description, 4000, true), saved.revision]);
    } else if (input.action === 'createGroup') {
      keys(input, ['action', 'boardId', 'name', 'creationId']);
      const create = await creation(c, 'board_group', workspace, input.creationId);
      if (create.exists) return snapshot(c, member);
      const board = await row(c, 'board', workspace, input.boardId);
      inserted((await c.query('INSERT INTO board_group(id,workspace_id,board_id,name,position) VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id', [create.id, workspace, board.id, text(input.name, 120), await nextPosition(c, 'board_group', workspace, board.id)])).rows[0]);
    } else if (input.action === 'updateGroup') {
      keys(input, ['action', 'id', 'revision', 'name', 'position']);
      const saved = await row(c, 'board_group', workspace, input.id); checkRevision(saved, input.revision);
      await c.query('UPDATE board_group SET name=$3,position=$4,revision=revision+1 WHERE workspace_id=$1 AND id=$2 AND revision=$5', [workspace, saved.id, text(input.name ?? saved.name, 120), integer(input.position ?? saved.position), saved.revision]);
    } else if (input.action === 'createTask') {
      keys(input, ['action', 'boardId', 'groupId', 'title', 'parentId', 'status', 'priority', 'dueDate', 'position', 'assigneeIds', 'creationId']);
      const create = await creation(c, 'task', workspace, input.creationId);
      if (create.exists) return snapshot(c, member);
      const board = await row(c, 'board', workspace, input.boardId);
      const { action: _action, boardId: _boardId, creationId: _creationId, ...patch } = input;
      const value = await taskValues(c, workspace, board.id, null, patch, { status: 'To do', priority: 'Medium', parent_id: null, due_date: null, position: await nextPosition(c, 'task', workspace, board.id), assigneeIds: [] });
      if (!value.title || !value.group_id) fail(400, 'Enter a task title and choose a group.');
      const task = inserted((await c.query(`INSERT INTO task(id,workspace_id,board_id,group_id,parent_id,title,status,priority,due_date,position)
        VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO NOTHING RETURNING id`, [create.id, workspace, board.id, value.group_id, value.parent_id, value.title, value.status, value.priority, value.due_date, value.position])).rows[0]);
      await assignments(c, workspace, task.id, value);
    } else if (input.action === 'updateTask') {
      keys(input, ['action', 'id', 'revision', 'patch']);
      const saved = await row(c, 'task', workspace, input.id); checkRevision(saved, input.revision);
      const value = await taskValues(c, workspace, saved.board_id, saved.id, input.patch, saved);
      await c.query(`UPDATE task SET group_id=$3,parent_id=$4,title=$5,status=$6,priority=$7,due_date=$8,position=$9,revision=revision+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND revision=$10`, [workspace, saved.id, value.group_id, value.parent_id, value.title, value.status, value.priority, value.due_date, value.position, saved.revision]);
      await assignments(c, workspace, saved.id, value);
    } else fail(400, 'Choose a valid work action.');
    return snapshot(c, member);
  });
}
