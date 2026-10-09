import {
  configureRecurrence,
  recurrenceCompleted,
  pauseArchivedRecurrence,
  recurrenceSnapshotSQL,
} from './recurrence-core.mjs';
import { readActiveTimer } from './time-core.mjs';
import { randomUUID } from 'node:crypto';
import { transaction } from './database.mjs';
import { taskActivityState, recordTaskActivity } from './updates-core.mjs';

export class WorkError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new WorkError(status, message);
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value) => {
  if (typeof value !== 'string' || !uuid.test(value)) fail(400, 'Choose a valid item.');
  return value.toLowerCase();
};
const text = (value, max, optional = false) => {
  if (typeof value !== 'string' || value.includes('\0') || value.length > max || (!optional && !value.trim()))
    fail(400, `Enter text of ${optional ? '0' : '1'}–${max} characters.`);
  return value.trim();
};
const integer = (value) => {
  if (!Number.isInteger(value) || value < 0 || value > 2147483646) fail(400, 'Choose a valid position.');
  return value;
};
const revision = (value) => {
  if (!Number.isInteger(value) || value < 1 || value > 2147483646)
    fail(400, 'Reload this item before saving.');
  return value;
};
const date = (value) => {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '0001-01-01' ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    fail(400, 'Choose a valid date.');
  return value;
};
const choice = (value, values) => {
  if (!values.includes(value)) fail(400, 'Choose a valid value.');
  return value;
};
const object = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Invalid request.');
  return value;
};
const keys = (value, allowed) => {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    fail(400, 'This field is not available for editing.');
};

async function liveMember(c, session, workspaceId) {
  const member = (
    await c.query(
      `SELECT u.id,u.display_name AS name,m.workspace_id,m.role FROM app_user u
    JOIN membership m ON m.user_id=u.id JOIN auth_session s ON s."userId"=u.auth_user_id
    WHERE u.auth_user_id=$1 AND s.id=$2 AND u.disabled_at IS NULL AND s."expiresAt">now()
    AND s."updatedAt">now()-interval '30 minutes' AND ($3::uuid IS NULL OR m.workspace_id=$3)
    ORDER BY m.workspace_id LIMIT 1`,
      [session.user.id, session.session.id, workspaceId ?? null],
    )
  ).rows[0];
  if (!member) fail(401, 'Sign in required.');
  return member;
}
export async function withMember(pool, auth, headers, write, action, allowViewer = false) {
  const session = await auth.api.getSession({ headers });
  if (!session) fail(401, 'Sign in required.');
  return transaction(pool, async (c) => {
    const initial = await liveMember(c, session);
    // The same workspace lock used by membership mutations makes role revocation
    // authoritative before writes, including requests handled by another worker.
    await c.query(`SELECT id FROM workspace WHERE id=$1 FOR ${write ? 'UPDATE' : 'SHARE'}`, [
      initial.workspace_id,
    ]);
    const member = await liveMember(c, session, initial.workspace_id);
    // Account operators lock app_user without the workspace lock. Hold the actor
    // row through each write so a concurrent disable wins before any mutation.
    if (write) {
      const enabled = await c.query('SELECT id FROM app_user WHERE id=$1 AND disabled_at IS NULL FOR SHARE', [
        member.id,
      ]);
      if (!enabled.rowCount) fail(401, 'Sign in required.');
    }
    if (write && !allowViewer && !['owner', 'editor'].includes(member.role))
      fail(403, 'Only owners and editors can change workspace work.');
    const result = await action(c, member);
    if (write) await c.query('UPDATE auth_session SET "updatedAt"=now() WHERE id=$1', [session.session.id]);
    return result;
  });
}
async function snapshot(c, member) {
  const workspace = [member.workspace_id];
  const boards = (
    await c.query(
      'SELECT id,name,description,revision,archived_at AS "archivedAt",archived_by AS "archivedBy" FROM board WHERE workspace_id=$1 ORDER BY created_at,id',
      workspace,
    )
  ).rows;
  const groups = (
    await c.query(
      'SELECT id,board_id AS "boardId",name,position,revision FROM board_group WHERE workspace_id=$1 ORDER BY position,id',
      workspace,
    )
  ).rows;
  const columns = (
    await c.query(
      'SELECT id,board_id AS "boardId",name,kind,configuration,position,revision FROM column_definition WHERE workspace_id=$1 ORDER BY position,id',
      workspace,
    )
  ).rows;
  const tasks = (
    await c.query(
      `SELECT t.id,t.board_id AS "boardId",t.group_id AS "groupId",t.parent_id AS "parentId",t.title,t.status,t.priority,
    ${recurrenceSnapshotSQL} AS recurrence,
    t.reminder_before AS "reminderBefore",t.reminder_after AS "reminderAfter",
    (t.reminder_eligible AND t.due_date IS NOT NULL) AS "reminderActive",
    to_char(t.due_date,'YYYY-MM-DD') AS "dueDate",t.position,t.revision,t.notes,t.updated_at AS "updatedAt",
    coalesce(t.archived_at,b.archived_at) AS "archivedAt",coalesce(t.archived_by,b.archived_by) AS "archivedBy",
    t.archive_batch_id AS "archiveBatchId",(b.archived_at IS NOT NULL) AS "boardArchived",
    ARRAY(SELECT d.prerequisite_id FROM task_dependency d WHERE d.workspace_id=t.workspace_id AND d.task_id=t.id ORDER BY d.prerequisite_id) AS "dependencyIds",
    ARRAY(SELECT a.user_id FROM task_assignee a WHERE a.workspace_id=t.workspace_id AND a.task_id=t.id ORDER BY a.user_id) AS "assigneeIds",
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'done',i.done,'position',i.position) ORDER BY i.position,i.id) FROM checklist_item i WHERE i.workspace_id=t.workspace_id AND i.task_id=t.id),'[]'::jsonb) AS checklist,
    coalesce((SELECT jsonb_agg(jsonb_build_object('columnId',v.column_id,'value',v.value) ORDER BY v.column_id) FROM task_field_value v WHERE v.workspace_id=t.workspace_id AND v.task_id=t.id),'[]'::jsonb) AS fields
    FROM task t JOIN board b ON b.workspace_id=t.workspace_id AND b.id=t.board_id WHERE t.workspace_id=$1 ORDER BY t.position,t.id`,
      workspace,
    )
  ).rows;
  const members = (
    await c.query(
      `SELECT u.id,u.display_name AS name,a.email,m.role FROM membership m
    JOIN app_user u ON u.id=m.user_id JOIN auth_user a ON a.id=u.auth_user_id
    WHERE m.workspace_id=$1 AND u.disabled_at IS NULL ORDER BY u.display_name,u.id`,
      workspace,
    )
  ).rows;
  const unreadNotifications = (
    await c.query(
      'SELECT count(*)::integer AS n FROM task_notification WHERE workspace_id=$1 AND recipient_id=$2 AND read_at IS NULL',
      [member.workspace_id, member.id],
    )
  ).rows[0].n;
  return {
    activeTimer: await readActiveTimer(c, member),
    serverNow: (await c.query('SELECT clock_timestamp() AS now')).rows[0].now,
    boards: boards.filter((item) => !item.archivedAt),
    archivedBoards: boards.filter((item) => item.archivedAt),
    groups,
    columns,
    tasks: tasks.filter((item) => !item.archivedAt),
    archivedTasks: tasks.filter((item) => item.archivedAt),
    members,
    unreadNotifications,
    actor: { id: member.id, name: member.name, role: member.role },
  };
}
export function readWork(pool, auth, headers) {
  return withMember(pool, auth, headers, false, snapshot);
}
async function row(c, table, workspace, itemId, includeArchived = false) {
  const result = (
    await c.query(`SELECT * FROM ${table} WHERE workspace_id=$1 AND id=$2`, [workspace, id(itemId)])
  ).rows[0];
  if (!result) fail(404, 'Item not found.');
  if (!includeArchived) {
    if (result.archived_at) fail(409, 'This item is archived. Restore it before making changes.');
    if (result.board_id) await row(c, 'board', workspace, result.board_id);
  }
  return result;
}
const checkRevision = (saved, expected) => {
  if (saved.revision !== revision(expected))
    fail(409, 'Someone changed this item. Reload the latest version before saving again.');
};
async function nextPosition(c, table, workspace, board) {
  const n = (
    await c.query(
      `SELECT coalesce(max(position),-1)+1 AS n FROM ${table} WHERE workspace_id=$1 AND board_id=$2`,
      [workspace, board],
    )
  ).rows[0].n;
  return integer(n);
}
async function taskValues(c, workspace, board, taskId, patch, current = {}) {
  object(patch);
  keys(patch, [
    'title',
    'groupId',
    'parentId',
    'status',
    'priority',
    'dueDate',
    'recurrence',
    'reminderBefore',
    'reminderAfter',
    'position',
    'assigneeIds',
    'dependencyIds',
    'notes',
    'checklist',
    'fields',
  ]);
  const value = { ...current };
  if ('notes' in patch) {
    if (typeof patch.notes !== 'string' || patch.notes.length > 50000 || patch.notes.includes('\0'))
      fail(400, 'Notes must contain at most 50,000 characters.');
    value.notes = patch.notes;
  }
  if ('title' in patch) value.title = text(patch.title, 240);
  if ('status' in patch) value.status = choice(patch.status, ['To do', 'In progress', 'Done']);
  if ('priority' in patch) value.priority = choice(patch.priority, ['Low', 'Medium', 'High']);
  if ('dueDate' in patch) value.due_date = date(patch.dueDate);
  for (const [field, column] of [
    ['reminderBefore', 'reminder_before'],
    ['reminderAfter', 'reminder_after'],
  ]) {
    if (field in patch) {
      if (typeof patch[field] !== 'boolean') fail(400, 'Choose a valid reminder setting.');
      value[column] = patch[field];
    }
  }
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
        const cycle = await c.query(
          `WITH RECURSIVE ancestors AS (
          SELECT id,parent_id FROM task WHERE workspace_id=$1 AND id=$2
          UNION SELECT t.id,t.parent_id FROM task t JOIN ancestors a ON t.id=a.parent_id WHERE t.workspace_id=$1
        ) SELECT 1 FROM ancestors WHERE id=$3`,
          [workspace, parent.id, taskId],
        );
        if (cycle.rowCount) fail(400, 'A task cannot be its own ancestor.');
      }
    }
  }
  if ('assigneeIds' in patch) {
    if (
      !Array.isArray(patch.assigneeIds) ||
      patch.assigneeIds.length > 4 ||
      patch.assigneeIds.some((x) => typeof x !== 'string' || !x || x.length > 128) ||
      new Set(patch.assigneeIds).size !== patch.assigneeIds.length
    )
      fail(400, 'Choose up to four distinct workspace members.');
    const members = await c.query(
      `SELECT m.user_id FROM membership m JOIN app_user u ON u.id=m.user_id
      WHERE m.workspace_id=$1 AND m.user_id=ANY($2::text[]) AND u.disabled_at IS NULL`,
      [workspace, patch.assigneeIds],
    );
    if (members.rowCount !== patch.assigneeIds.length)
      fail(400, 'Assignees must be active workspace members.');
    value.assigneeIds = patch.assigneeIds;
  }
  if ('dependencyIds' in patch) {
    if (!taskId || !Array.isArray(patch.dependencyIds) || patch.dependencyIds.length > 50)
      fail(400, 'Choose up to 50 distinct prerequisites for this saved task.');
    const dependencies = patch.dependencyIds.map(id);
    if (new Set(dependencies).size !== dependencies.length) fail(400, 'Choose each prerequisite only once.');
    if (dependencies.includes(taskId)) fail(400, 'A task cannot depend on itself.');
    const existing = (
      await c.query('SELECT prerequisite_id FROM task_dependency WHERE workspace_id=$1 AND task_id=$2', [
        workspace,
        taskId,
      ])
    ).rows.map((entry) => entry.prerequisite_id);
    const candidates = (
      await c.query(
        `SELECT t.id,coalesce(t.archived_at,b.archived_at) AS archived_at FROM task t
       JOIN board b ON b.workspace_id=t.workspace_id AND b.id=t.board_id
       WHERE t.workspace_id=$1 AND t.id=ANY($2::uuid[])`,
        [workspace, dependencies],
      )
    ).rows;
    if (candidates.length !== dependencies.length) fail(400, 'Prerequisites must belong to this workspace.');
    if (candidates.some((entry) => entry.archived_at && !existing.includes(entry.id)))
      fail(409, 'Restore an archived prerequisite before adding it.');
    const cycle = await c.query(
      `WITH RECURSIVE ancestors(id) AS (
        SELECT unnest($2::uuid[])
        UNION SELECT d.prerequisite_id FROM task_dependency d JOIN ancestors a ON d.task_id=a.id
        WHERE d.workspace_id=$1
      ) SELECT 1 FROM ancestors WHERE id=$3 LIMIT 1`,
      [workspace, dependencies, taskId],
    );
    if (cycle.rowCount) fail(400, 'These prerequisites would create a dependency cycle.');
    value.dependencyIds = dependencies;
  }
  return value;
}
async function dependencies(c, workspace, task, values) {
  if (!('dependencyIds' in values)) return;
  await c.query('DELETE FROM task_dependency WHERE workspace_id=$1 AND task_id=$2', [workspace, task]);
  await c.query(
    'INSERT INTO task_dependency(workspace_id,task_id,prerequisite_id) SELECT $1,$2,unnest($3::uuid[])',
    [workspace, task, values.dependencyIds],
  );
}
async function assignments(c, workspace, task, values) {
  if (!('assigneeIds' in values)) return;
  await c.query('DELETE FROM task_assignee WHERE workspace_id=$1 AND task_id=$2', [workspace, task]);
  for (const member of values.assigneeIds)
    await c.query('INSERT INTO task_assignee(workspace_id,task_id,user_id) VALUES($1,$2,$3)', [
      workspace,
      task,
      member,
    ]);
}

function columnValues(input) {
  const kind = choice(input.kind, ['text', 'status', 'number', 'date', 'link']);
  const configuration = object(input.configuration ?? {});
  if (kind === 'status') {
    keys(configuration, ['options']);
    if (
      !Array.isArray(configuration.options) ||
      configuration.options.length < 1 ||
      configuration.options.length > 20
    )
      fail(400, 'Choose between 1 and 20 status options.');
    const options = configuration.options.map((value) => text(value, 80));
    if (new Set(options).size !== options.length) fail(400, 'Status options must be distinct.');
    return { kind, configuration: { options } };
  }
  if (kind === 'number') {
    keys(configuration, ['format', 'currency']);
    const format = choice(configuration.format ?? 'number', ['number', 'cost']);
    if (format === 'cost')
      return {
        kind,
        configuration: { format, currency: choice(configuration.currency, ['EUR', 'USD', 'GBP']) },
      };
    if ('currency' in configuration) fail(400, 'Currency is only available for cost columns.');
    return { kind, configuration: { format } };
  }
  keys(configuration, []);
  return { kind, configuration: {} };
}
function fieldValue(column, value) {
  if (value === null) return null;
  if (column.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12)
      fail(400, 'Enter a finite number between −1 trillion and 1 trillion.');
    // Work in decimal representation: floating-point rounding must not allow
    // a real third decimal place, especially near the maximum allowed value.
    if (column.configuration.format === 'cost') {
      const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
      const decimals = (coefficient.split('.')[1]?.length ?? 0) - Number(exponent);
      if (decimals > 2) fail(400, 'Costs can have at most two decimal places.');
    }
    return value;
  }
  if (typeof value !== 'string' || value.includes('\0')) fail(400, 'Enter a valid text value.');
  if (column.kind === 'text') {
    if (value.length > 1000) fail(400, 'Text fields allow at most 1,000 characters.');
    return value;
  }
  if (column.kind === 'status') return choice(value, column.configuration.options ?? []);
  if (column.kind === 'date') return date(value);
  if (value.length > 2048 || /[\u0000-\u0020\u007f-\u009f\\]/.test(value) || !/^https?:\/\//i.test(value))
    fail(400, 'Enter an absolute http or https link without spaces or credentials.');
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(400, 'Enter a valid link.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
    fail(400, 'Enter an http or https link without credentials.');
  return value;
}
async function details(c, workspace, board, task, patch) {
  if ('fields' in patch) {
    if (!Array.isArray(patch.fields) || patch.fields.length > 20) fail(400, 'Choose up to 20 column values.');
    const seen = new Set();
    for (const field of patch.fields) {
      object(field);
      keys(field, ['columnId', 'revision', 'value']);
      const columnId = id(field.columnId);
      if (seen.has(columnId)) fail(400, 'Each column value can appear only once.');
      seen.add(columnId);
      const column = await row(c, 'column_definition', workspace, columnId);
      if (column.board_id !== board) fail(400, 'The column must belong to this board.');
      checkRevision(column, field.revision);
      const value = fieldValue(column, field.value);
      if (value === null)
        await c.query('DELETE FROM task_field_value WHERE workspace_id=$1 AND task_id=$2 AND column_id=$3', [
          workspace,
          task,
          column.id,
        ]);
      else
        await c.query(
          `INSERT INTO task_field_value(workspace_id,board_id,task_id,column_id,value) VALUES($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT(task_id,column_id) DO UPDATE SET value=excluded.value`,
          [workspace, board, task, column.id, JSON.stringify(value)],
        );
    }
  }
  if ('checklist' in patch) {
    if (!Array.isArray(patch.checklist) || patch.checklist.length > 50)
      fail(400, 'A checklist can contain up to 50 items.');
    const seen = new Set();
    const values = patch.checklist.map((item) => {
      object(item);
      keys(item, ['id', 'label', 'done', 'position']);
      const itemId = id(item.id);
      if (seen.has(itemId) || typeof item.done !== 'boolean')
        fail(400, 'Choose distinct checklist items with a valid completion state.');
      seen.add(itemId);
      return { id: itemId, label: text(item.label, 500), done: item.done, position: integer(item.position) };
    });
    const collisions = await c.query(
      'SELECT id FROM checklist_item WHERE id=ANY($1::uuid[]) AND (workspace_id<>$2 OR task_id<>$3)',
      [[...seen], workspace, task],
    );
    if (collisions.rowCount) fail(409, 'A checklist identifier is unavailable. Reload this task.');
    await c.query('DELETE FROM checklist_item WHERE workspace_id=$1 AND task_id=$2', [workspace, task]);
    for (const item of values) {
      const result = await c.query(
        `INSERT INTO checklist_item(id,workspace_id,task_id,label,done,position) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(id) DO NOTHING RETURNING id`,
        [item.id, workspace, task, item.label, item.done, item.position],
      );
      if (!result.rowCount) fail(409, 'A checklist identifier is unavailable. Reload this task.');
    }
  }
}

// The entity UUID is also the bounded retry key: no extra key ledger or expiry.
// A successful retry returns current state and never replays the original fields.
async function creation(c, table, workspace, value) {
  if (value === undefined) return { id: null, exists: false };
  const creationId = id(value);
  const saved = (await c.query(`SELECT workspace_id FROM ${table} WHERE id=$1`, [creationId])).rows[0];
  if (saved && saved.workspace_id !== workspace)
    fail(409, 'This creation identifier is unavailable. Start a new item.');
  return { id: creationId, exists: Boolean(saved) };
}
const inserted = (row) => {
  // Different workspaces use different locks, so a concurrent UUID collision
  // must also be rejected by the table's primary key without exposing its row.
  if (!row) fail(409, 'This creation identifier is unavailable. Start a new item.');
  return row;
};
async function changeArchive(c, member, input) {
  const workspace = member.workspace_id;
  const isBoard = input.action.endsWith('Board');
  const restoring = input.action.startsWith('restore');
  if (isBoard && member.role !== 'owner') fail(403, 'Only owners can archive or restore boards.');
  const saved = await row(c, isBoard ? 'board' : 'task', workspace, input.id, true);
  // A stale retry must not toggle a subsequently changed item. A current-state
  // no-op is harmless, but still requires the exact revision the caller saw.
  checkRevision(saved, input.revision);
  if (isBoard) {
    if (Boolean(saved.archived_at) !== restoring) return;
    await c.query(
      `UPDATE board SET archived_at=CASE WHEN $3 THEN NULL ELSE now() END,
      archived_by=CASE WHEN $3 THEN NULL ELSE $4 END,revision=revision+1 WHERE workspace_id=$1 AND id=$2`,
      [workspace, saved.id, restoring, member.id],
    );
    // Invalidate pre-archive drafts even if the board is restored before a late
    // request reaches the server. The workspace lock serializes every write.
    for (const table of ['task', 'board_group', 'column_definition']) {
      await c.query(`UPDATE ${table} SET revision=revision+1 WHERE workspace_id=$1 AND board_id=$2`, [
        workspace,
        saved.id,
      ]);
    }
    await pauseArchivedRecurrence(c, workspace);
    await c.query(
      `INSERT INTO board_archive_activity(workspace_id,board_id,revision,event,actor_id,actor_name)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [workspace, saved.id, saved.revision + 1, restoring ? 'restored' : 'archived', member.id, member.name],
    );
    return;
  }
  await row(c, 'board', workspace, saved.board_id);
  if (Boolean(saved.archived_at) !== restoring) return;
  if (restoring && saved.parent_id) {
    const parent = await row(c, 'task', workspace, saved.parent_id, true);
    if (parent.archived_at) fail(409, 'Restore the parent task first.');
  }
  const descendants = (
    await c.query(
      `WITH RECURSIVE subtree AS (
    SELECT id,parent_id,archived_at,archive_batch_id FROM task WHERE workspace_id=$1 AND id=$2
    UNION ALL SELECT t.id,t.parent_id,t.archived_at,t.archive_batch_id FROM task t JOIN subtree s ON t.parent_id=s.id WHERE t.workspace_id=$1
  ) SELECT id FROM subtree WHERE ${restoring ? 'archive_batch_id=$3' : 'archived_at IS NULL'}`,
      restoring ? [workspace, saved.id, saved.archive_batch_id] : [workspace, saved.id],
    )
  ).rows;
  const batch = restoring ? null : randomUUID();
  for (const item of descendants) {
    const before = await taskActivityState(c, workspace, item.id);
    await c.query(
      `UPDATE task SET archived_at=CASE WHEN $3 THEN NULL ELSE now() END,
      archived_by=CASE WHEN $3 THEN NULL ELSE $4 END,archive_batch_id=$5,revision=revision+1,updated_at=now()
      WHERE workspace_id=$1 AND id=$2`,
      [workspace, item.id, restoring, member.id, batch],
    );
    await pauseArchivedRecurrence(c, workspace);
    await recordTaskActivity(c, member, before, await taskActivityState(c, workspace, item.id));
  }
}

export function manageWork(pool, auth, headers, input) {
  return withMember(pool, auth, headers, true, async (c, member) => {
    object(input);
    const workspace = member.workspace_id;
    if (['archiveTask', 'restoreTask', 'archiveBoard', 'restoreBoard'].includes(input.action)) {
      keys(input, ['action', 'id', 'revision']);
      await changeArchive(c, member, input);
    } else if (input.action === 'createBoard') {
      keys(input, ['action', 'name', 'description', 'creationId']);
      const create = await creation(c, 'board', workspace, input.creationId);
      if (create.exists) return snapshot(c, member);
      const board = inserted(
        (
          await c.query(
            'INSERT INTO board(id,workspace_id,name,description) VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id',
            [create.id, workspace, text(input.name, 120), text(input.description ?? '', 4000, true)],
          )
        ).rows[0],
      );
      await c.query("INSERT INTO board_group(workspace_id,board_id,name) VALUES($1,$2,'Tasks')", [
        workspace,
        board.id,
      ]);
    } else if (input.action === 'updateBoard') {
      keys(input, ['action', 'id', 'revision', 'name', 'description']);
      const saved = await row(c, 'board', workspace, input.id);
      checkRevision(saved, input.revision);
      await c.query(
        'UPDATE board SET name=$3,description=$4,revision=revision+1 WHERE workspace_id=$1 AND id=$2 AND revision=$5',
        [
          workspace,
          saved.id,
          text(input.name ?? saved.name, 120),
          text(input.description ?? saved.description, 4000, true),
          saved.revision,
        ],
      );
    } else if (input.action === 'createGroup') {
      keys(input, ['action', 'boardId', 'name', 'creationId']);
      const create = await creation(c, 'board_group', workspace, input.creationId);
      if (create.exists) return snapshot(c, member);
      const board = await row(c, 'board', workspace, input.boardId);
      inserted(
        (
          await c.query(
            'INSERT INTO board_group(id,workspace_id,board_id,name,position) VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id',
            [
              create.id,
              workspace,
              board.id,
              text(input.name, 120),
              await nextPosition(c, 'board_group', workspace, board.id),
            ],
          )
        ).rows[0],
      );
    } else if (input.action === 'updateGroup') {
      keys(input, ['action', 'id', 'revision', 'name', 'position']);
      const saved = await row(c, 'board_group', workspace, input.id);
      checkRevision(saved, input.revision);
      await c.query(
        'UPDATE board_group SET name=$3,position=$4,revision=revision+1 WHERE workspace_id=$1 AND id=$2 AND revision=$5',
        [
          workspace,
          saved.id,
          text(input.name ?? saved.name, 120),
          integer(input.position ?? saved.position),
          saved.revision,
        ],
      );
    } else if (input.action === 'createColumn') {
      keys(input, ['action', 'boardId', 'name', 'kind', 'configuration', 'position', 'creationId']);
      const create = await creation(c, 'column_definition', workspace, input.creationId);
      if (create.exists) return snapshot(c, member);
      const board = await row(c, 'board', workspace, input.boardId);
      const count = (
        await c.query(
          'SELECT count(*)::integer AS n FROM column_definition WHERE workspace_id=$1 AND board_id=$2',
          [workspace, board.id],
        )
      ).rows[0].n;
      if (count >= 20) fail(400, 'A board can have up to 20 custom columns.');
      const value = columnValues(input);
      inserted(
        (
          await c.query(
            `INSERT INTO column_definition(id,workspace_id,board_id,name,kind,configuration,position)
        VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT(id) DO NOTHING RETURNING id`,
            [
              create.id,
              workspace,
              board.id,
              text(input.name, 120),
              value.kind,
              JSON.stringify(value.configuration),
              integer(input.position ?? (await nextPosition(c, 'column_definition', workspace, board.id))),
            ],
          )
        ).rows[0],
      );
    } else if (input.action === 'updateColumn') {
      keys(input, ['action', 'id', 'revision', 'name', 'kind', 'configuration', 'position']);
      const saved = await row(c, 'column_definition', workspace, input.id);
      checkRevision(saved, input.revision);
      const value = columnValues({
        kind: input.kind ?? saved.kind,
        configuration: input.configuration ?? saved.configuration,
      });
      const used = (
        await c.query('SELECT value FROM task_field_value WHERE workspace_id=$1 AND column_id=$2', [
          workspace,
          saved.id,
        ])
      ).rows;
      if (used.length) {
        if (
          value.kind !== saved.kind ||
          (saved.kind === 'number' &&
            (value.configuration.format !== (saved.configuration.format ?? 'number') ||
              value.configuration.currency !== saved.configuration.currency))
        )
          fail(400, 'Clear this column’s saved values before changing its type or number format.');
        if (saved.kind === 'status' && used.some((item) => !value.configuration.options.includes(item.value)))
          fail(400, 'An option is still used by a task. Clear or change those values before removing it.');
      }
      await c.query(
        `UPDATE column_definition SET name=$3,kind=$4,configuration=$5::jsonb,position=$6,revision=revision+1
        WHERE workspace_id=$1 AND id=$2 AND revision=$7`,
        [
          workspace,
          saved.id,
          text(input.name ?? saved.name, 120),
          value.kind,
          JSON.stringify(value.configuration),
          integer(input.position ?? saved.position),
          saved.revision,
        ],
      );
    } else if (input.action === 'createTask') {
      keys(input, [
        'action',
        'boardId',
        'groupId',
        'title',
        'parentId',
        'status',
        'priority',
        'dueDate',
        'position',
        'assigneeIds',
        'creationId',
      ]);
      const create = await creation(c, 'task', workspace, input.creationId);
      if (create.exists) return snapshot(c, member);
      const board = await row(c, 'board', workspace, input.boardId);
      const { action: _action, boardId: _boardId, creationId: _creationId, ...patch } = input;
      const value = await taskValues(c, workspace, board.id, null, patch, {
        status: 'To do',
        priority: 'Medium',
        parent_id: null,
        due_date: null,
        position: await nextPosition(c, 'task', workspace, board.id),
        assigneeIds: [],
      });
      if (!value.title || !value.group_id) fail(400, 'Enter a task title and choose a group.');
      const task = inserted(
        (
          await c.query(
            `INSERT INTO task(id,workspace_id,board_id,group_id,parent_id,title,status,priority,due_date,position)
        VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO NOTHING RETURNING id`,
            [
              create.id,
              workspace,
              board.id,
              value.group_id,
              value.parent_id,
              value.title,
              value.status,
              value.priority,
              value.due_date,
              value.position,
            ],
          )
        ).rows[0],
      );
      await assignments(c, workspace, task.id, value);
      await recordTaskActivity(c, member, null, await taskActivityState(c, workspace, task.id));
    } else if (input.action === 'updateTask') {
      keys(input, ['action', 'id', 'revision', 'patch']);
      const saved = await row(c, 'task', workspace, input.id);
      checkRevision(saved, input.revision);
      const before = await taskActivityState(c, workspace, saved.id);
      const value = await taskValues(c, workspace, saved.board_id, saved.id, input.patch, saved);
      await c.query(
        `UPDATE task SET group_id=$3,parent_id=$4,title=$5,status=$6,priority=$7,due_date=$8,position=$9,notes=$11,reminder_before=$12,reminder_after=$13,reminder_eligible=CASE WHEN due_date IS DISTINCT FROM $8::date OR (NOT reminder_before AND $12) OR (NOT reminder_after AND $13) THEN true ELSE reminder_eligible END,revision=revision+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND revision=$10`,
        [
          workspace,
          saved.id,
          value.group_id,
          value.parent_id,
          value.title,
          value.status,
          value.priority,
          value.due_date,
          value.position,
          saved.revision,
          value.notes,
          value.reminder_before,
          value.reminder_after,
        ],
      );
      await dependencies(c, workspace, saved.id, value);
      await assignments(c, workspace, saved.id, value);
      await details(c, workspace, saved.board_id, saved.id, input.patch);
      await configureRecurrence(c, member, saved.id, input.patch.recurrence);
      await recurrenceCompleted(c, workspace, saved.id, saved.status, value.status);
      await recordTaskActivity(c, member, before, await taskActivityState(c, workspace, saved.id));
    } else fail(400, 'Choose a valid work action.');
    return snapshot(c, member);
  });
}
