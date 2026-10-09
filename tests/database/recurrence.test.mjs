import { localDate, occurrenceDate } from '../../src/server/recurrence-calendar.mjs';
import { runJobs } from '../../src/server/jobs-core.mjs';
import { readUpdates, manageUpdates } from '../../src/server/updates-core.mjs';
import { readFile, readdir, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import {
  localRoot,
  openLocalCluster,
  provisionLocalDatabase,
  grantApplicationAccess,
} from '../../scripts/db/local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate, migrationsDirectory } from '../../scripts/db/migrate.mjs';
import { createAuthentication, verifiedActor } from '../../src/server/auth-core.mjs';
import { createFirstOwner } from '../../src/server/account-operator.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { workHttpHandler } from '../../src/server/work-http.mjs';
import { templatesHttpHandler } from '../../src/server/templates-http.mjs';

let local, admin, pool, auth, handle, templateHandle, owner, ownerCookie, workspace;
const options = { secret: randomBytes(48).toString('hex'), baseURL: 'http://127.0.0.1:3100' };
const password = 'Disposable work test password 123!';
const cookies = (res) =>
  res.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
const request = (body, cookie = ownerCookie, origin = options.baseURL) =>
  new Request(`${options.baseURL}/api/work`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin, 'content-type': 'application/json', cookie: cookie ?? '' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const work = (body, cookie, origin) => handle(request(body, cookie, origin));
async function ok(body, cookie) {
  const res = await work(body, cookie);
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
}
async function login(email) {
  const res = await authHttpHandler(
    auth,
    pool,
    options.baseURL,
  )(
    new Request(`${options.baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { origin: options.baseURL, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(res.status, 200, await res.clone().text());
  return cookies(res);
}
async function member(email, role = 'editor', inWorkspace = workspace) {
  const user = (
    await createAuthentication(pool, { ...options, allowSignup: true }).api.signUpEmail({
      body: { name: email, email, password },
    })
  ).user.id;
  await admin.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)', [
    inWorkspace,
    user,
    role,
  ]);
  return { id: user, cookie: await login(email) };
}
async function board(name = 'Project') {
  const data = await ok({ action: 'createBoard', name });
  const b = data.boards.find((x) => x.name === name);
  return { ...b, group: data.groups.find((x) => x.boardId === b.id).id };
}
async function task(b, title = 'Task', extra = {}) {
  const { notes, checklist, fields, ...basic } = extra;
  let data = await ok({ action: 'createTask', boardId: b.id, groupId: b.group, title, ...basic });
  const created = data.tasks.find((x) => x.title === title);
  const patch = {
    ...(notes === undefined ? {} : { notes }),
    ...(checklist === undefined ? {} : { checklist }),
    ...(fields === undefined ? {} : { fields }),
  };
  if (Object.keys(patch).length)
    data = await ok({ action: 'updateTask', id: created.id, revision: created.revision, patch });
  return data.tasks.find((x) => x.id === created.id);
}

before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true });
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/recurrence-`)}/postgres`, 55449);
  await local.cluster.start();
  await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl);
  await migrate(admin);
  await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
  templateHandle = templatesHttpHandler(pool, auth, options);
});
beforeEach(async () => {
  await admin.query(
    'TRUNCATE workspace,app_user,auth_user,auth_rate_limit,auth_verification,invitation_rate_limit CASCADE',
  );
  owner = await createFirstOwner(pool, options, { name: 'Owner', email: 'owner@example.test', password });
  ownerCookie = await login('owner@example.test');
  workspace = (await verifiedActor(auth, pool, new Headers({ cookie: ownerCookie }))).workspaceId;
});
after(async () => {
  await pool?.end();
  await admin?.end();
  await local?.cluster.stop();
});
function template(body, cookie = ownerCookie, origin = options.baseURL) {
  return templateHandle(
    new Request(`${options.baseURL}/api/templates`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie: cookie ?? '', origin, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function templateOK(body, cookie) {
  const res = await template(body, cookie);
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
}
const save = (kind, source, name = 'Reusable') => ({
  action: 'save',
  creationId: randomUUID(),
  kind,
  sourceId: source.id,
  revision: source.revision,
  name,
});
const use = (t, extra = {}) => ({
  action: 'use',
  creationId: randomUUID(),
  templateId: t.id,
  revision: t.revision,
  ...extra,
});

const update = (t, patch, cookie) =>
  work({ action: 'updateTask', id: t.id, revision: t.revision, patch }, cookie);
async function updated(t, patch, cookie) {
  const response = await update(t, patch, cookie);
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).tasks.find((x) => x.id === t.id);
}
async function rejected(t, patch, status = 400, cookie) {
  const before = (await ok()).tasks.find((x) => x.id === t.id);
  const response = await update(t, patch, cookie);
  assert.equal(response.status, status, await response.clone().text());
  assert.deepEqual(
    (await ok()).tasks.find((x) => x.id === t.id),
    before,
  );
}

const recurrence = (extra = {}) => ({
  mode: 'calendar',
  unit: 'day',
  interval: 1,
  timeZone: 'Europe/Athens',
  enabled: true,
  ...extra,
});
const at = (value = '2030-04-01T06:00:00Z') => runJobs(pool, { now: value });
const occurrences = async () =>
  (
    await admin.query(
      "SELECT *,to_char(scheduled_date,'YYYY-MM-DD') AS date FROM task_recurrence_occurrence ORDER BY scheduled_date,created_at,task_id",
    )
  ).rows;
const seriesRows = async () => (await admin.query('SELECT * FROM task_recurrence ORDER BY id')).rows;
const generated = async (sourceId) =>
  (await ok()).tasks.filter((t) => t.recurrence?.sourceTaskId === sourceId && !t.recurrence.isSource);

test('calendar setup creates only latest missed and one future with source-linked system provenance', async () => {
  const b = await board();
  let source = await task(b, 'Daily', { dueDate: '2020-01-01', assigneeIds: [owner] });
  source = await updated(source, { recurrence: recurrence() });
  assert.equal(source.recurrence.isSource, true);
  assert.equal(source.recurrence.mode, 'calendar');
  const revision = source.revision,
    activityCount = (
      await admin.query('SELECT count(*)::int AS n FROM task_activity WHERE task_id=$1', [source.id])
    ).rows[0].n;
  const result = await at();
  assert.equal(result.recurrenceCreated, 2);
  assert.deepEqual(
    (await occurrences()).map((o) => o.date),
    ['2020-01-01', '2030-04-01', '2030-04-02'],
  );
  let data = await ok();
  assert.equal(data.tasks.find((t) => t.id === source.id).revision, revision);
  assert.equal(
    (await admin.query('SELECT count(*)::int AS n FROM task_activity WHERE task_id=$1', [source.id])).rows[0]
      .n,
    activityCount,
  );
  assert.equal(
    (await generated(source.id)).every((t) => t.recurrence.isSource === false),
    true,
  );
  const events = (
    await admin.query("SELECT actor_id,actor_name,event FROM task_activity WHERE event='recurrence_created'")
  ).rows;
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.actor_id === null && e.actor_name === 'Recurrence'));
  const updates = await readUpdates(pool, auth, new Headers({ cookie: ownerCookie }));
  assert.ok(updates.items.some((i) => i.actorName === 'Recurrence'));
  assert.equal((await at('2030-04-01T06:01:00Z')).recurrenceCreated, 0);
  await at('2030-04-10T06:00:00Z');
  assert.deepEqual(
    (await occurrences()).map((o) => o.date),
    ['2020-01-01', '2030-04-01', '2030-04-02', '2030-04-10', '2030-04-11'],
  );
});

test('one future original is enough and future reminder options get real advance notice', async () => {
  const b = await board();
  let source = await task(b, 'Future', { dueDate: '2030-04-05', assigneeIds: [owner] });
  source = await updated(source, { reminderBefore: true, recurrence: recurrence() });
  assert.equal((await at()).recurrenceCreated, 0);
  assert.equal((await occurrences()).length, 1);
  assert.equal((await at('2030-04-05T00:00:00Z')).recurrenceCreated, 1);
  assert.equal((await generated(source.id))[0].dueDate, '2030-04-06');
  await at('2030-04-05T06:00:00Z');
  assert.ok(
    (
      await admin.query(
        'SELECT n.summary FROM task_notification n JOIN task_reminder_job j ON j.id=n.reminder_job_id WHERE j.task_id<>$1',
        [source.id],
      )
    ).rows.some((r) => r.summary.includes('day-before')),
  );
});

test('configuration and template refresh require source revision and owner/editor authority', async () => {
  const b = await board(),
    viewer = await member('viewer@example.test', 'viewer'),
    editor = await member('editor@example.test');
  let source = await task(b, 'Roles', { dueDate: '2020-01-01' });
  await rejected(source, { recurrence: recurrence() }, 403, viewer.cookie);
  for (const patch of [
    recurrence({ interval: 0 }),
    recurrence({ interval: 366 }),
    recurrence({ timeZone: 'bad' }),
    recurrence({ mode: 'bad' }),
    recurrence({ unit: 'year' }),
    recurrence({ anchorDate: '2020-02-30' }),
    recurrence({ refreshTemplate: 'yes' }),
  ])
    await rejected(source, { title: 'Must roll back', recurrence: patch });
  const stale = source;
  source = await updated(source, { recurrence: recurrence() }, editor.cookie);
  await rejected(stale, { recurrence: { enabled: false } }, 409);
  assert.deepEqual((await ok(undefined, viewer.cookie)).tasks[0].recurrence, source.recurrence);
  await at();
  const child = (await generated(source.id))[0];
  await rejected(child, { recurrence: { enabled: false } });
  await updated(child, { notes: 'Occurrence-specific', recurrence: null });
  source = (await ok()).tasks.find((t) => t.id === source.id);
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1', [editor.id]);
  await rejected(source, { recurrence: { refreshTemplate: true } }, 401, editor.cookie);
});

test('frozen recipe copies approved content and resets progress, hierarchy and nonportable field types', async () => {
  const b = await board(),
    assignee = await member('assignee@example.test');
  const columns = [];
  for (const [name, kind, configuration] of [
    ['Text', 'text', {}],
    ['Number', 'number', {}],
    ['Date', 'date', {}],
    ['Link', 'link', {}],
    ['Status', 'status', { options: ['Fresh', 'Old'] }],
  ]) {
    const data = await ok({ action: 'createColumn', boardId: b.id, name, kind, configuration });
    columns.push(data.columns.find((c) => c.name === name));
  }
  const parent = await task(b, 'Parent');
  let source = await task(b, 'Recipe', {
    dueDate: '2020-01-01',
    assigneeIds: [assignee.id],
    parentId: parent.id,
    priority: 'High',
  });
  source = await updated(source, {
    notes: 'Instructions',
    checklist: [{ id: randomUUID(), label: 'Do it', done: true, position: 0 }],
    dependencyIds: [parent.id],
    reminderBefore: true,
    reminderAfter: true,
    fields: columns.map((c, i) => ({
      columnId: c.id,
      revision: c.revision,
      value: ['Keep', 12, '2020-01-01', 'https://example.test', 'Old'][i],
    })),
    recurrence: recurrence(),
  });
  source = await updated(source, {
    title: 'Edited source',
    notes: 'Not automatically copied',
    reminderAfter: false,
  });
  await task(b, 'Subtask', { parentId: source.id });
  await at();
  const copies = await generated(source.id);
  assert.equal(copies.length, 2);
  for (const copy of copies) {
    assert.equal(copy.title, 'Recipe');
    assert.equal(copy.notes, 'Instructions');
    assert.equal(copy.priority, 'High');
    assert.equal(copy.status, 'To do');
    assert.equal(copy.parentId, null);
    assert.deepEqual(copy.dependencyIds, []);
    assert.equal(copy.checklist[0].done, false);
    assert.notEqual(copy.checklist[0].id, source.checklist[0].id);
    assert.equal(copy.fields.length, 2);
    assert.equal(copy.reminderAfter, true);
    assert.deepEqual(copy.assigneeIds, [assignee.id]);
  }
  source = (await ok()).tasks.find((t) => t.id === source.id);
  source = await updated(source, { recurrence: { refreshTemplate: true } });
  await at('2030-04-03T06:00:00Z');
  const refreshed = (await generated(source.id)).find((t) => t.dueDate === '2030-04-04');
  assert.equal(refreshed.title, 'Edited source');
  assert.equal(refreshed.notes, 'Not automatically copied');
  assert.equal(refreshed.reminderAfter, false);
});

test('completion chains use first real transitions and allow independent same-day successors', async () => {
  const b = await board();
  let source = await task(b, 'Completion', { status: 'Done' });
  source = await updated(source, { recurrence: recurrence({ mode: 'completion', unit: 'month' }) });
  assert.equal(source.recurrence.state, 'waiting');
  await at();
  assert.equal((await generated(source.id)).length, 0);
  source = await updated(source, { notes: 'Does not fabricate completion' });
  await at('2030-04-01T06:01:00Z');
  assert.equal((await generated(source.id)).length, 0);
  source = await updated(source, { status: 'To do' });
  source = await updated(source, { status: 'Done' });
  const completed = (await occurrences())[0].completed_at;
  assert.ok(completed);
  await at('2030-04-01T06:02:00Z');
  let first = (await generated(source.id))[0];
  assert.equal(first.dueDate, occurrenceDate(localDate(completed, 'Europe/Athens'), 'month', 1));
  source = await updated(source, { status: 'To do' });
  source = await updated(source, { status: 'Done' });
  await at('2030-04-01T06:03:00Z');
  assert.equal((await generated(source.id)).length, 1);
  first = await updated(first, { status: 'Done' });
  await at('2030-04-01T06:04:00Z');
  const copies = await generated(source.id);
  assert.equal(copies.length, 2);
  assert.equal(copies[0].dueDate, copies[1].dueDate);
  assert.notEqual(copies[0].id, copies[1].id);
});

test('source and board archive persistently pause while generated task archive leaves series active', async () => {
  const b = await board();
  let source = await task(b, 'Archive', { dueDate: '2020-01-01' });
  source = await updated(source, { recurrence: recurrence() });
  await at();
  let child = (await generated(source.id))[0];
  await ok({ action: 'archiveTask', id: child.id, revision: child.revision });
  assert.equal((await seriesRows())[0].enabled, true);
  source = (await ok()).tasks.find((t) => t.id === source.id);
  await ok({ action: 'archiveTask', id: source.id, revision: source.revision });
  assert.equal((await seriesRows())[0].enabled, false);
  source = (await ok()).archivedTasks.find((t) => t.id === source.id);
  await ok({ action: 'restoreTask', id: source.id, revision: source.revision });
  await at('2030-04-03T06:00:00Z');
  assert.equal((await occurrences()).length, 3);
  source = (await ok()).tasks.find((t) => t.id === source.id);
  source = await updated(source, { recurrence: { enabled: true } });
  await at('2030-04-03T06:01:00Z');
  assert.equal((await occurrences()).length, 5);
  await ok({ action: 'archiveBoard', id: b.id, revision: b.revision });
  assert.equal((await seriesRows())[0].enabled, false);
  const archived = (await ok()).archivedBoards[0];
  await ok({ action: 'restoreBoard', id: b.id, revision: archived.revision });
  assert.equal((await seriesRows())[0].enabled, false);
});

test('schedule edits are prospective, retain the existing future copy and avoid calendar duplicate dates', async () => {
  const b = await board();
  let source = await task(b, 'Edit', { dueDate: '2020-01-01' });
  source = await updated(source, { recurrence: recurrence() });
  await at();
  const future = (await generated(source.id)).find((t) => t.dueDate === '2030-04-02');
  source = (await ok()).tasks.find((t) => t.id === source.id);
  source = await updated(source, { recurrence: recurrence({ unit: 'week', timeZone: 'America/New_York' }) });
  await at('2030-04-01T06:01:00Z');
  assert.equal((await generated(source.id)).filter((t) => t.dueDate > '2030-04-01').length, 1);
  assert.ok((await generated(source.id)).some((t) => t.id === future.id));
  const rows = await occurrences();
  assert.equal(new Set(rows.map((o) => o.date)).size, rows.length);
  source = (await ok()).tasks.find((t) => t.id === source.id);
  source = await updated(source, { recurrence: recurrence({ mode: 'completion' }) });
  await at('2030-04-01T06:02:00Z');
  assert.equal((await occurrences()).length, rows.length);
  assert.equal(source.recurrence.state, 'waiting');
});

test('bounded retries roll back partial materialization and explicit recipe repair requeues', async () => {
  const b = await board();
  let source = await task(b, 'Retry', { dueDate: '2020-01-01' });
  source = await updated(source, {
    checklist: [{ id: randomUUID(), label: 'Step', done: false, position: 0 }],
    recurrence: recurrence(),
  });
  await admin.query(
    `CREATE FUNCTION reject_recurring_checklist() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private materialization error'; END $$;CREATE TRIGGER reject_recurring_checklist BEFORE INSERT ON checklist_item FOR EACH ROW EXECUTE FUNCTION reject_recurring_checklist()`,
  );
  try {
    assert.equal((await at()).recurrenceRetried, 1);
    assert.equal((await occurrences()).length, 1);
    assert.equal((await ok()).tasks.length, 1);
    assert.equal((await at('2030-04-01T06:00:29Z')).recurrenceExamined, 0);
    for (const time of ['06:00:30', '06:01:30', '06:03:30', '06:07:30']) await at(`2030-04-01T${time}Z`);
    const series = (await seriesRows())[0];
    assert.equal(series.attempts, 5);
    assert.equal(series.last_error_code, 'P0001');
    assert.equal((await ok()).tasks[0].recurrence.state, 'failed');
    assert.equal((await at('2030-04-02T06:00:00Z')).recurrenceExamined, 0);
  } finally {
    await admin.query(
      'DROP TRIGGER reject_recurring_checklist ON checklist_item;DROP FUNCTION reject_recurring_checklist()',
    );
  }
  source = (await ok()).tasks[0];
  source = await updated(source, { recurrence: { refreshTemplate: true } });
  assert.equal((await at('2030-04-02T06:01:00Z')).recurrenceCreated, 2);
  assert.equal((await occurrences()).length, 3);
});

test('current member removal and concurrent operator disable filter frozen recipe assignees', async () => {
  const b = await board(),
    removed = await member('removed@example.test'),
    disabled = await member('disabled@example.test');
  let source = await task(b, 'Members', {
    dueDate: '2020-01-01',
    assigneeIds: [owner, removed.id, disabled.id],
  });
  source = await updated(source, { recurrence: recurrence() });
  await admin.query('DELETE FROM membership WHERE workspace_id=$1 AND user_id=$2', [workspace, removed.id]);
  const operator = await admin.connect();
  let pending;
  try {
    await operator.query('BEGIN');
    await operator.query('UPDATE app_user SET disabled_at=now() WHERE id=$1', [disabled.id]);
    pending = at();
    let blocked = false;
    for (let i = 0; i < 100; i++) {
      blocked =
        (
          await admin.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query LIKE '%u.id=ANY%FOR SHARE OF u%' AND wait_event_type='Lock'",
          )
        ).rowCount > 0;
      if (blocked) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(blocked, true);
    await operator.query('COMMIT');
    assert.equal((await pending).recurrenceCreated, 2);
  } finally {
    await operator.query('ROLLBACK');
    operator.release();
    await pending;
  }
  for (const child of await generated(source.id)) assert.deepEqual(child.assigneeIds, [owner]);
});

test('series/copies survive real database restart and two workers create one set', async () => {
  const b = await board();
  let source = await task(b, 'Durable', { dueDate: '2020-01-01' });
  source = await updated(source, { recurrence: recurrence() });
  await pool.end();
  await admin.end();
  await local.cluster.stop();
  await local.cluster.start();
  admin = createDatabase(local.adminUrl);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
  templateHandle = templatesHttpHandler(pool, auth, options);
  const results = await Promise.all([at(), at()]);
  assert.equal(
    results.reduce((n, r) => n + r.recurrenceCreated, 0),
    2,
  );
  assert.equal((await occurrences()).length, 3);
  const ids = (await occurrences()).map((o) => o.task_id);
  await at('2030-04-01T06:01:00Z');
  assert.deepEqual(
    (await occurrences()).map((o) => o.task_id),
    ids,
  );
});

test('database connection termination after inserting a generated task rolls back and safely recovers', async () => {
  const b = await board();
  let source = await task(b, 'Interrupted', { dueDate: '2020-01-01' });
  source = await updated(source, { recurrence: recurrence() });
  const crashingPool = {
    query: (...args) => pool.query(...args),
    connect: async () => {
      const client = await pool.connect();
      client.on('error', () => {});
      const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      return {
        query: async (sql, params) => {
          const result = await client.query(sql, params);
          if (sql.startsWith('INSERT INTO task(id,workspace_id,board_id,group_id,title,notes')) {
            await admin.query('SELECT pg_terminate_backend($1)', [pid]);
            throw new Error('Worker interrupted after task insert');
          }
          return result;
        },
        release: () => client.release(true),
      };
    },
  };
  await assert.rejects(runJobs(crashingPool, { now: '2030-04-01T06:00:00Z' }));
  assert.equal((await occurrences()).length, 1);
  assert.equal((await ok()).tasks.length, 1);
  assert.equal((await at()).recurrenceCreated, 2);
});

test('column schema conflicts fail safely and refreshed recipes repair them without leaking partial tasks', async () => {
  const b = await board();
  let data = await ok({ action: 'createColumn', boardId: b.id, name: 'Amount', kind: 'number' });
  let column = data.columns[0];
  let source = await task(b, 'Schema', { dueDate: '2020-01-01' });
  source = await updated(source, {
    fields: [{ columnId: column.id, revision: column.revision, value: 5 }],
    recurrence: recurrence(),
  });
  source = await updated(source, {
    fields: [{ columnId: column.id, revision: column.revision, value: null }],
  });
  await ok({
    action: 'updateColumn',
    id: column.id,
    revision: column.revision,
    kind: 'text',
    configuration: {},
  });
  assert.equal((await at()).recurrenceRetried, 1);
  assert.equal((await ok()).tasks.length, 1);
  assert.equal((await seriesRows())[0].last_error_code, 'RFILD');
  source = (await ok()).tasks[0];
  source = await updated(source, { recurrence: { refreshTemplate: true } });
  assert.equal((await at('2030-04-01T06:01:00Z')).recurrenceCreated, 2);
});

test('ordinary template reuse never clones an active recurrence series', async () => {
  const b = await board();
  let source = await task(b, 'Source', { dueDate: '2020-01-01' });
  source = await updated(source, { recurrence: recurrence() });
  const saved = (await templateOK(save('board', b))).template;
  const copy = await templateOK(use(saved, { name: 'Template copy' }));
  assert.ok((await ok()).tasks.filter((t) => t.boardId === copy.boardId).every((t) => t.recurrence === null));
  assert.equal((await seriesRows()).length, 1);
});

test('pending genuine completion survives cadence/timezone edits and unchanged failed saves do not reset attempts', async () => {
  const b = await board();
  let source = await task(b, 'Pending');
  source = await updated(source, { recurrence: recurrence({ mode: 'completion' }) });
  source = await updated(source, { status: 'Done' });
  const before = (await seriesRows())[0];
  assert.ok(before.pending_completion_at);
  source = await updated(source, {
    recurrence: recurrence({ mode: 'completion', unit: 'week', interval: 2, timeZone: 'America/New_York' }),
  });
  const changed = (await seriesRows())[0];
  assert.equal(changed.pending_predecessor_id, source.id);
  assert.equal(changed.pending_completion_at.toISOString(), before.pending_completion_at.toISOString());
  assert.equal(
    source.recurrence.nextDate,
    occurrenceDate(localDate(before.pending_completion_at, 'America/New_York'), 'week', 2),
  );
  await at();
  assert.equal((await generated(source.id)).length, 1);
  await admin.query("UPDATE task_recurrence SET attempts=5,last_error_code='RFILD' WHERE id=$1", [
    source.recurrence.id,
  ]);
  source = (await ok()).tasks.find((t) => t.id === source.id);
  source = await updated(source, {
    notes: 'No implicit requeue',
    recurrence: recurrence({ mode: 'completion', unit: 'week', interval: 2, timeZone: 'America/New_York' }),
  });
  assert.equal((await seriesRows())[0].attempts, 5);
});

test('calendar-to-completion targets retained future task rather than a missed occurrence', async () => {
  const b = await board();
  let source = await task(b, 'Switch', { dueDate: '2020-01-01' });
  source = await updated(source, { recurrence: recurrence() });
  await at();
  const future = (await generated(source.id)).find((t) => t.dueDate === '2030-04-02');
  source = (await ok()).tasks.find((t) => t.id === source.id);
  source = await updated(source, { recurrence: { unit: 'week' } });
  await at('2030-04-01T06:01:00Z');
  assert.equal((await seriesRows())[0].latest_task_id, future.id);
  source = (await ok()).tasks.find((t) => t.id === source.id);
  source = await updated(source, { recurrence: { mode: 'completion' } });
  const current = (await ok()).tasks.find((t) => t.id === future.id);
  await updated(current, { status: 'Done' });
  assert.equal((await seriesRows())[0].pending_predecessor_id, future.id);
  assert.equal((await at('2030-04-01T06:02:00Z')).recurrenceCreated, 1);
});

test('editing to a future anchor creates that anchor itself after existing scheduled future passes', async () => {
  const b = await board();
  let source = await task(b, 'New anchor', { dueDate: '2020-01-01' });
  source = await updated(source, { recurrence: recurrence() });
  source = await updated(source, { recurrence: { anchorDate: '2031-01-31', unit: 'month' } });
  assert.equal((await at()).recurrenceCreated, 1);
  assert.deepEqual(
    (await generated(source.id)).map((t) => t.dueDate),
    ['2031-01-31'],
  );
  await at('2031-02-01T06:00:00Z');
  assert.ok((await generated(source.id)).some((t) => t.dueDate === '2031-02-28'));
});
