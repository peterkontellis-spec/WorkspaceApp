import { createHash, randomUUID } from 'node:crypto';
import { WorkError, withMember } from './work-core.mjs';
import { taskActivityState, recordTaskActivity } from './updates-core.mjs';
const fail = (status, message) => {
  throw new WorkError(status, message);
};
const uuid = (value) => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    fail(400, 'Choose a valid item.');
  return value.toLowerCase();
};
const name = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 120 || value.includes('\0'))
    fail(400, 'Enter a name of 1–120 characters.');
  return value.trim();
};
const revision = (value) => {
  if (!Number.isInteger(value) || value < 1 || value > 2147483646)
    fail(400, 'Reload this item before saving.');
  return value;
};
const keys = (value, allowed) => {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    fail(400, 'This field is not available for editing.');
};
const canonical = (value) =>
  JSON.stringify(value, (_, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry,
  );
const columnsSQL = 'id,name,kind,configuration,position';
const metadataSQL = `id,name,kind,revision,created_by AS "createdBy",created_at AS "createdAt",archived_at AS "archivedAt",
 jsonb_array_length(snapshot->'tasks') AS "taskCount",jsonb_array_length(snapshot->'groups') AS "groupCount",jsonb_array_length(snapshot->'columns') AS "columnCount"`;
async function metadata(c, workspace, templateId) {
  return (
    await c.query(`SELECT ${metadataSQL} FROM work_template WHERE workspace_id=$1 AND id=$2`, [
      workspace,
      templateId,
    ])
  ).rows[0];
}
export function readTemplates(pool, auth, headers) {
  return withMember(pool, auth, headers, false, async (c, member) => {
    const rows = (
      await c.query(
        `SELECT ${metadataSQL} FROM work_template WHERE workspace_id=$1 ORDER BY created_at DESC,id`,
        [member.workspace_id],
      )
    ).rows;
    return {
      templates: rows.filter((x) => !x.archivedAt),
      archivedTemplates: rows.filter((x) => x.archivedAt),
      actor: { id: member.id, role: member.role },
    };
  });
}
async function source(c, workspace, table, itemId) {
  const row = (await c.query(`SELECT * FROM ${table} WHERE workspace_id=$1 AND id=$2`, [workspace, itemId]))
    .rows[0];
  if (!row) fail(404, 'Source work not found.');
  if (row.archived_at) fail(409, 'Restore the source work before using it.');
  return row;
}
const checkRevision = (row, value) => {
  if (row.revision !== value) fail(409, 'This item changed. Reload it before continuing.');
};
async function capture(c, workspace, kind, sourceId, version) {
  const root = await source(c, workspace, kind === 'board' ? 'board' : 'task', sourceId);
  checkRevision(root, version);
  const board = kind === 'board' ? root : await source(c, workspace, 'board', root.board_id);
  // Bound transfer before loading notes/checklists; recursive UNION also terminates
  // safely if a malformed legacy hierarchy contains a cycle.
  const selection =
    kind === 'task'
      ? `WITH RECURSIVE subtree AS (
      SELECT id FROM task WHERE workspace_id=$1 AND board_id=$2 AND id=$3 AND archived_at IS NULL
      UNION SELECT t.id FROM task t JOIN subtree s ON t.parent_id=s.id
      WHERE t.workspace_id=$1 AND t.board_id=$2 AND t.archived_at IS NULL
    ) SELECT t.id,t.parent_id AS "parentId",t.group_id AS "groupId",t.title,t.notes,t.priority,t.position
      FROM task t JOIN subtree s ON s.id=t.id ORDER BY t.position,t.id LIMIT 201`
      : `SELECT id,parent_id AS "parentId",group_id AS "groupId",title,notes,priority,position
      FROM task WHERE workspace_id=$1 AND board_id=$2 AND archived_at IS NULL ORDER BY position,id LIMIT 201`;
  const rows = (
    await c.query(selection, kind === 'task' ? [workspace, board.id, root.id] : [workspace, board.id])
  ).rows;
  if (rows.length > 200)
    fail(400, 'A template can contain up to 200 tasks and subtasks. Split this work into smaller templates.');
  const taskIds = rows.map((task) => task.id);
  const checklist = (
    await c.query(
      'SELECT task_id,label,position FROM checklist_item WHERE workspace_id=$1 AND task_id=ANY($2::uuid[]) ORDER BY position,id',
      [workspace, taskIds],
    )
  ).rows;
  const values = (
    await c.query(
      'SELECT task_id,column_id,value FROM task_field_value WHERE workspace_id=$1 AND task_id=ANY($2::uuid[])',
      [workspace, taskIds],
    )
  ).rows;
  let columns = (
    await c.query(
      `SELECT ${columnsSQL} FROM column_definition WHERE workspace_id=$1 AND board_id=$2 ORDER BY position,id`,
      [workspace, board.id],
    )
  ).rows;
  if (kind === 'task') {
    const used = new Set(values.map((value) => value.column_id));
    columns = columns.filter((column) => used.has(column.id));
  }
  const retained = new Set(
    columns.filter((column) => ['text', 'number'].includes(column.kind)).map((column) => column.id),
  );
  const groups =
    kind === 'board'
      ? (
          await c.query(
            'SELECT id,name,position FROM board_group WHERE workspace_id=$1 AND board_id=$2 ORDER BY position,id LIMIT 101',
            [workspace, board.id],
          )
        ).rows
      : [];
  if (groups.length > 100 || columns.length > 20)
    fail(400, 'A template supports up to 100 groups and 20 custom columns.');
  const included = new Set(taskIds);
  const tasks = rows.map((task) => ({
    ...task,
    parentId: included.has(task.parentId) ? task.parentId : null,
    checklist: checklist
      .filter((item) => item.task_id === task.id)
      .map(({ label, position }) => ({ label, position })),
    fields: values
      .filter((value) => value.task_id === task.id && retained.has(value.column_id))
      .map((value) => ({ columnId: value.column_id, value: value.value })),
  }));
  const result = {
    version: 1,
    description: kind === 'board' ? board.description : '',
    rootId: kind === 'task' ? root.id : null,
    groups,
    columns,
    tasks,
  };
  if (Buffer.byteLength(JSON.stringify(result)) > 2 * 1024 * 1024)
    fail(400, 'This template is too large. Shorten its notes or split it into smaller templates.');
  return result;
}
async function apply(c, member, template, input) {
  const workspace = member.workspace_id,
    snapshot = template.snapshot;
  if (template.snapshot_version !== 1 || snapshot.version !== 1)
    fail(409, 'This template version is not supported.');
  let boardId, groupId;
  const groupMap = new Map(),
    columnMap = new Map();
  if (template.kind === 'board') {
    boardId = randomUUID();
    await c.query('INSERT INTO board(id,workspace_id,name,description) VALUES($1,$2,$3,$4)', [
      boardId,
      workspace,
      name(input.name),
      snapshot.description,
    ]);
    for (const group of snapshot.groups) {
      const newId = randomUUID();
      groupMap.set(group.id, newId);
      await c.query(
        'INSERT INTO board_group(id,workspace_id,board_id,name,position) VALUES($1,$2,$3,$4,$5)',
        [newId, workspace, boardId, group.name, group.position],
      );
    }
    if (!snapshot.groups.length)
      await c.query("INSERT INTO board_group(workspace_id,board_id,name) VALUES($1,$2,'Tasks')", [
        workspace,
        boardId,
      ]);
  } else {
    boardId = uuid(input.boardId);
    groupId = uuid(input.groupId);
    await source(c, workspace, 'board', boardId);
    const group = await source(c, workspace, 'board_group', groupId);
    if (group.board_id !== boardId) fail(400, 'Choose a group on the destination board.');
  }
  const existing = (
    await c.query(
      `SELECT ${columnsSQL} FROM column_definition WHERE workspace_id=$1 AND board_id=$2 ORDER BY position,id`,
      [workspace, boardId],
    )
  ).rows;
  let columnPosition = Math.max(-1, ...existing.map((column) => column.position)) + 1;
  const mappedColumns = new Set();
  for (const column of snapshot.columns) {
    const named = existing.filter((item) => item.name === column.name);
    const exact = named.filter(
      (item) =>
        item.kind === column.kind && canonical(item.configuration) === canonical(column.configuration),
    );
    const matching = exact.find((item) => !mappedColumns.has(item.id));
    if (template.kind === 'task' && named.length && !exact.length)
      fail(
        409,
        `The destination column “${column.name}” has a different type or settings. Choose another board or align that column first.`,
      );
    if (template.kind === 'task' && matching) {
      columnMap.set(column.id, matching.id);
      mappedColumns.add(matching.id);
      continue;
    }
    if (existing.length >= 20)
      fail(409, 'This copy would exceed the destination limit of 20 custom columns.');
    const newId = randomUUID();
    columnMap.set(column.id, newId);
    mappedColumns.add(newId);
    await c.query(
      'INSERT INTO column_definition(id,workspace_id,board_id,name,kind,configuration,position) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',
      [
        newId,
        workspace,
        boardId,
        column.name,
        column.kind,
        JSON.stringify(column.configuration),
        columnPosition++,
      ],
    );
    existing.push({ ...column, id: newId });
  }
  const taskMap = new Map(snapshot.tasks.map((task) => [task.id, randomUUID()]));
  let remaining = [...snapshot.tasks],
    inserted = new Set();
  const base =
    template.kind === 'task'
      ? (
          await c.query(
            'SELECT coalesce(max(position),-1)+1 AS position FROM task WHERE workspace_id=$1 AND board_id=$2 AND group_id=$3',
            [workspace, boardId, groupId],
          )
        ).rows[0].position
      : 0;
  let offset = 0;
  while (remaining.length) {
    const ready = remaining.filter((task) => !task.parentId || inserted.has(task.parentId));
    if (!ready.length)
      fail(409, 'This template has an invalid task hierarchy. Save it again from valid work.');
    for (const task of ready) {
      const newId = taskMap.get(task.id),
        destinationGroup = template.kind === 'task' ? groupId : groupMap.get(task.groupId);
      if (!destinationGroup) fail(409, 'This template has a missing group. Save it again.');
      await c.query(
        "INSERT INTO task(id,workspace_id,board_id,group_id,parent_id,title,notes,priority,status,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'To do',$9)",
        [
          newId,
          workspace,
          boardId,
          destinationGroup,
          task.parentId ? taskMap.get(task.parentId) : null,
          task.title,
          task.notes,
          task.priority,
          template.kind === 'task' ? base + offset++ : task.position,
        ],
      );
      for (const item of task.checklist)
        await c.query('INSERT INTO checklist_item(workspace_id,task_id,label,position) VALUES($1,$2,$3,$4)', [
          workspace,
          newId,
          item.label,
          item.position,
        ]);
      for (const field of task.fields)
        await c.query(
          'INSERT INTO task_field_value(workspace_id,board_id,task_id,column_id,value) VALUES($1,$2,$3,$4,$5::jsonb)',
          [workspace, boardId, newId, columnMap.get(field.columnId), JSON.stringify(field.value)],
        );
      await recordTaskActivity(c, member, null, await taskActivityState(c, workspace, newId));
      inserted.add(task.id);
    }
    remaining = remaining.filter((task) => !inserted.has(task.id));
  }
  return { boardId, ...(template.kind === 'task' ? { taskId: taskMap.get(snapshot.rootId) } : {}) };
}
export function manageTemplates(pool, auth, headers, input) {
  return withMember(pool, auth, headers, true, async (c, member) => {
    const enabled = await c.query('SELECT id FROM app_user WHERE id=$1 AND disabled_at IS NULL FOR SHARE', [
      member.id,
    ]);
    if (!enabled.rowCount) fail(401, 'Sign in required.');
    const workspace = member.workspace_id;
    if (['archive', 'restore'].includes(input.action)) {
      keys(input, ['action', 'id', 'revision']);
      const saved = (
        await c.query('SELECT * FROM work_template WHERE workspace_id=$1 AND id=$2', [
          workspace,
          uuid(input.id),
        ])
      ).rows[0];
      if (!saved) fail(404, 'Template not found.');
      if (saved.kind === 'board' && member.role !== 'owner')
        fail(403, 'Only owners can archive or restore board templates.');
      checkRevision(saved, revision(input.revision));
      const restoring = input.action === 'restore';
      if (Boolean(saved.archived_at) === restoring)
        await c.query(
          'UPDATE work_template SET archived_at=CASE WHEN $3 THEN NULL ELSE now() END,archived_by=CASE WHEN $3 THEN NULL ELSE $4 END,revision=revision+1 WHERE workspace_id=$1 AND id=$2',
          [workspace, saved.id, restoring, member.id],
        );
      return { template: await metadata(c, workspace, saved.id) };
    }
    if (!['save', 'use'].includes(input.action)) fail(400, 'Choose a valid template action.');
    keys(
      input,
      input.action === 'save'
        ? ['action', 'creationId', 'kind', 'sourceId', 'revision', 'name']
        : ['action', 'creationId', 'templateId', 'revision', 'name', 'boardId', 'groupId'],
    );
    const creationId = uuid(input.creationId),
      fingerprint = createHash('sha256').update(canonical(input)).digest('hex');
    const previous = (
      await c.query(
        'SELECT actor_id,fingerprint,result FROM template_operation WHERE workspace_id=$1 AND creation_id=$2',
        [workspace, creationId],
      )
    ).rows[0];
    if (previous) {
      if (previous.actor_id !== member.id || previous.fingerprint !== fingerprint)
        fail(409, 'This request changed after it was submitted. Start a new copy or save.');
      return previous.result;
    }
    let result;
    if (input.action === 'save') {
      if (!['task', 'board'].includes(input.kind)) fail(400, 'Choose a task or board template.');
      const templateName = name(input.name),
        sourceId = uuid(input.sourceId),
        version = revision(input.revision);
      const snapshot = await capture(c, workspace, input.kind, sourceId, version);
      const templateId = randomUUID();
      await c.query(
        'INSERT INTO work_template(id,workspace_id,name,kind,snapshot,created_by) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
        [templateId, workspace, templateName, input.kind, JSON.stringify(snapshot), member.id],
      );
      result = { template: await metadata(c, workspace, templateId) };
    } else {
      const template = (
        await c.query('SELECT * FROM work_template WHERE workspace_id=$1 AND id=$2', [
          workspace,
          uuid(input.templateId),
        ])
      ).rows[0];
      if (!template) fail(404, 'Template not found.');
      checkRevision(template, revision(input.revision));
      if (template.archived_at) fail(409, 'Restore this template before using it.');
      if (template.kind === 'board' && (input.boardId !== undefined || input.groupId !== undefined))
        fail(400, 'Board templates create a new board.');
      if (template.kind === 'task' && input.name !== undefined)
        fail(400, 'Task templates keep their saved task titles.');
      result = await apply(c, member, template, input);
    }
    await c.query(
      'INSERT INTO template_operation(workspace_id,creation_id,actor_id,fingerprint,result) VALUES($1,$2,$3,$4,$5::jsonb)',
      [workspace, creationId, member.id, fingerprint, JSON.stringify(result)],
    );
    return result;
  });
}
