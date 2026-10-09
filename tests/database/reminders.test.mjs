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
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/reminders-`)}/postgres`, 55448);
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

const at = (value) => runJobs(pool, { now: value });
const notices = async () =>
  (await admin.query('SELECT * FROM task_notification WHERE reminder_job_id IS NOT NULL ORDER BY id')).rows;
const jobs = async () =>
  (
    await admin.query(
      "SELECT *,to_char(due_date,'YYYY-MM-DD') AS date FROM task_reminder_job ORDER BY scheduled_at,id",
    )
  ).rows;
const headers = (cookie = ownerCookie) => new Headers({ cookie });
const due = '2030-04-01';
const morning = '2030-04-01T06:00:00Z';

test('default Athens due reminder is one internal notification per current assignee without a user edit', async () => {
  const b = await board();
  const viewer = await member('viewer@example.test', 'viewer');
  const t = await task(b, 'Due', { dueDate: due, assigneeIds: [owner, viewer.id] });
  assert.equal(t.reminderBefore, false);
  assert.equal(t.reminderAfter, false);
  assert.equal(t.reminderActive, true);
  assert.equal((await at('2030-04-01T05:59:59Z')).delivered, 0);
  const before = (await ok()).tasks;
  assert.equal((await at(morning)).delivered, 1);
  assert.equal((await notices()).length, 2);
  assert.deepEqual((await ok()).tasks, before);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM task_activity')).rows[0].n, 1);
  assert.equal((await at(morning)).delivered, 0);
  const ownerUpdates = await readUpdates(pool, auth, headers());
  assert.equal(ownerUpdates.items[0].actorName, 'Reminder');
  assert.equal(ownerUpdates.items[0].taskId, t.id);
  assert.equal(ownerUpdates.items[0].createdAt, morning.replace('Z', '.000Z'));
  const viewerUpdates = await readUpdates(pool, auth, headers(viewer.cookie));
  assert.equal(viewerUpdates.items.length, 2); // Original assignment stays readable.
  const id = viewerUpdates.items[0].id;
  await manageUpdates(pool, auth, headers(viewer.cookie), { action: 'setRead', id, read: true });
  assert.ok((await readUpdates(pool, auth, headers(viewer.cookie))).items[0].readAt);
  assert.equal(
    (await readUpdates(pool, auth, headers(), { before: ownerUpdates.items[0].id })).items.length,
    0,
  );
  await assert.rejects(manageUpdates(pool, auth, headers(), { action: 'setRead', id, read: true }), {
    status: 404,
  });
  assert.equal((await readUpdates(pool, auth, headers(), { taskId: t.id })).items.length, 1);
});

test('extra reminders save atomically with revision/role checks and activity descriptions', async () => {
  const b = await board(),
    viewer = await member('viewer@example.test', 'viewer'),
    editor = await member('editor@example.test');
  let t = await task(b, 'Settings', { dueDate: due, assigneeIds: [owner] });
  await rejected(t, { reminderBefore: true }, 403, viewer.cookie);
  await rejected(t, { reminderBefore: 'yes', notes: 'No partial save' });
  await rejected(t, { reminderAfter: true, checklist: [{ label: '' }] });
  const stale = t;
  t = await updated(t, { reminderBefore: true, reminderAfter: true, notes: 'Together' }, editor.cookie);
  assert.equal(t.reminderBefore, true);
  assert.equal(t.reminderAfter, true);
  assert.equal(t.notes, 'Together');
  await rejected(stale, { reminderAfter: false }, 409);
  assert.equal((await ok(undefined, viewer.cookie)).tasks[0].reminderAfter, true);
  const activity = (
    await admin.query(
      'SELECT changed_fields,summary FROM task_activity WHERE task_id=$1 ORDER BY id DESC LIMIT 1',
      [t.id],
    )
  ).rows[0];
  assert.ok(activity.changed_fields.includes('reminderBefore'));
  assert.match(activity.summary, /overdue reminder/);
  assert.equal((await at('2030-03-31T06:00:00Z')).delivered, 1);
  assert.equal((await at(morning)).delivered, 1);
  assert.equal((await at('2030-04-02T06:00:00Z')).delivered, 1);
  assert.equal((await notices()).length, 3);
});

test('catch-up sends only the latest elapsed enabled reminder and never redelivers across toggles', async () => {
  const b = await board();
  let t = await task(b, 'Catch up', { dueDate: due, assigneeIds: [owner] });
  t = await updated(t, { reminderBefore: true, reminderAfter: true });
  assert.equal((await at('2030-04-10T06:00:00Z')).delivered, 1);
  assert.deepEqual(
    (await jobs()).map((j) => j.state),
    ['superseded', 'superseded', 'delivered'],
  );
  t = await updated(t, { reminderAfter: false, reminderBefore: false, status: 'Done', dueDate: null });
  await at('2030-04-10T06:01:00Z');
  t = await updated(t, { dueDate: due, status: 'To do', reminderBefore: true, reminderAfter: true });
  await at('2030-04-11T06:00:00Z');
  assert.equal((await notices()).length, 1);
});

test('current dates, assignment, completion, task/board archive and membership control delivery', async () => {
  const b = await board(),
    old = await member('old@example.test'),
    current = await member('current@example.test');
  let t = await task(b, 'Changes', { dueDate: due, assigneeIds: [old.id] });
  await at('2030-03-30T00:00:00Z');
  t = await updated(t, { dueDate: '2030-04-03', assigneeIds: [current.id] });
  await at(morning);
  assert.equal((await notices()).length, 0);
  t = await updated(t, { status: 'Done' });
  await at('2030-04-03T06:00:00Z');
  assert.equal((await notices()).length, 0);
  t = await updated(t, { status: 'To do' });
  await ok({ action: 'archiveTask', id: t.id, revision: t.revision });
  await at('2030-04-03T06:01:00Z');
  let data = await ok();
  t = data.archivedTasks[0];
  await ok({ action: 'restoreTask', id: t.id, revision: t.revision });
  await ok({ action: 'archiveBoard', id: b.id, revision: b.revision });
  await at('2030-04-03T06:02:00Z');
  assert.equal((await notices()).length, 0);
  data = await ok();
  await ok({ action: 'restoreBoard', id: b.id, revision: data.archivedBoards[0].revision });
  await admin.query('DELETE FROM membership WHERE workspace_id=$1 AND user_id=$2', [workspace, current.id]);
  await at('2030-04-03T06:03:00Z');
  assert.equal((await notices()).length, 0);
  t = (await ok()).tasks[0];
  t = await updated(t, { assigneeIds: [owner] });
  await at('2030-04-03T06:05:00Z');
  assert.deepEqual(
    (await notices()).map((n) => n.recipient_id),
    [owner],
  );
  await ok({ action: 'archiveTask', id: t.id, revision: t.revision });
  t = (await ok()).archivedTasks[0];
  await ok({ action: 'restoreTask', id: t.id, revision: t.revision });
  await at('2030-04-04T06:00:00Z');
  assert.equal((await notices()).length, 1);
});

test('two workers serialize one delivery, and scheduled rows survive real database restart', async () => {
  const b = await board();
  await task(b, 'Durable', { dueDate: due, assigneeIds: [owner] });
  await at('2030-03-30T00:00:00Z');
  assert.equal((await jobs())[0].state, 'pending');
  await pool.end();
  await admin.end();
  await local.cluster.stop();
  await local.cluster.start();
  admin = createDatabase(local.adminUrl);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
  templateHandle = templatesHttpHandler(pool, auth, options);
  const result = await Promise.all([at(morning), at(morning)]);
  assert.equal(
    result.reduce((n, r) => n + r.delivered, 0),
    1,
  );
  assert.equal((await notices()).length, 1);
  assert.equal((await jobs())[0].state, 'delivered');
});

test('Athens DST offsets are calculated per local calendar date across spring and fall', async () => {
  const b = await board();
  for (const date of ['2030-03-30', '2030-03-31', '2030-10-26', '2030-10-27'])
    await task(b, date, { dueDate: date, assigneeIds: [owner] });
  await at('2030-01-01T00:00:00Z');
  assert.deepEqual(
    (await jobs()).map((j) => j.scheduled_at.toISOString()),
    [
      '2030-03-30T07:00:00.000Z',
      '2030-03-31T06:00:00.000Z',
      '2030-10-26T06:00:00.000Z',
      '2030-10-27T07:00:00.000Z',
    ],
  );
});

test('recipient failure rolls back all effects, retries with backoff and stops after five failures', async () => {
  const b = await board(),
    other = await member('retry@example.test');
  await task(b, 'Retry', { dueDate: due, assigneeIds: [owner, other.id] });
  await admin.query(
    `CREATE FUNCTION reject_reminder() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reminder_job_id IS NOT NULL THEN RAISE EXCEPTION 'private error must not be stored'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_reminder BEFORE INSERT ON task_notification FOR EACH ROW EXECUTE FUNCTION reject_reminder()`,
  );
  try {
    assert.equal((await at(morning)).retried, 1);
    assert.equal((await notices()).length, 0);
    let j = (await jobs())[0];
    assert.equal(j.attempts, 1);
    assert.equal(j.last_error_code, 'P0001');
    assert.equal(j.next_attempt_at.toISOString(), '2030-04-01T06:00:30.000Z');
    assert.equal((await at('2030-04-01T06:00:29Z')).examined, 0);
    for (const time of ['06:00:30', '06:01:30', '06:03:30', '06:07:30']) await at(`2030-04-01T${time}Z`);
    j = (await jobs())[0];
    assert.equal(j.state, 'failed');
    assert.equal(j.attempts, 5);
    assert.equal((await at('2030-04-02T06:00:00Z')).examined, 0);
  } finally {
    await admin.query('DROP TRIGGER reject_reminder ON task_notification;DROP FUNCTION reject_reminder()');
  }
  assert.equal((await notices()).length, 0);
});

test('partial recipient insert rolls back before a successful retry', async () => {
  const b = await board(),
    other = await member('retry-success@example.test');
  await task(b, 'Retry success', { dueDate: due, assigneeIds: [owner, other.id] });
  const failId = [owner, other.id].sort().at(-1);
  await admin.query(
    `CREATE FUNCTION fail_second_reminder() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reminder_job_id IS NOT NULL AND NEW.recipient_id='${failId}' THEN RAISE EXCEPTION 'fail second'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_second_reminder BEFORE INSERT ON task_notification FOR EACH ROW EXECUTE FUNCTION fail_second_reminder()`,
  );
  try {
    assert.equal((await at(morning)).retried, 1);
    assert.equal((await notices()).length, 0);
  } finally {
    await admin.query(
      'DROP TRIGGER fail_second_reminder ON task_notification;DROP FUNCTION fail_second_reminder()',
    );
  }
  assert.equal((await at('2030-04-01T06:00:30Z')).delivered, 1);
  assert.equal((await notices()).length, 2);
  await at('2030-04-01T06:01:00Z');
  assert.equal((await notices()).length, 2);
});

test('worker waits for a concurrent account disable and excludes that recipient', async () => {
  const b = await board(),
    other = await member('disable@example.test');
  await task(b, 'Disable race', { dueDate: due, assigneeIds: [other.id] });
  const operator = await admin.connect();
  let pending;
  try {
    await operator.query('BEGIN');
    await operator.query('UPDATE app_user SET disabled_at=now() WHERE id=$1', [other.id]);
    pending = at(morning);
    let blocked = false;
    for (let i = 0; i < 100; i++) {
      blocked =
        (
          await admin.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query LIKE '%ORDER BY u.id FOR SHARE OF u%' AND wait_event_type='Lock'",
          )
        ).rowCount > 0;
      if (blocked) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(blocked, true);
    await operator.query('COMMIT');
    assert.equal((await pending).delivered, 0);
    assert.equal((await notices()).length, 0);
  } finally {
    await operator.query('ROLLBACK');
    operator.release();
    await pending;
  }
});

test('legacy overdue activation excludes migration backlog but explicit due-date or extra opt-in activates it', async () => {
  const b = await board();
  let t = await task(b, 'Legacy', { dueDate: '2020-01-01', assigneeIds: [owner] });
  // Execute the migration's exact activation statement against a legacy fixture.
  const migration = await readFile(
    new URL('../../database/migrations/011_task_reminders.sql', import.meta.url),
    'utf8',
  );
  await admin.query(migration.match(/UPDATE task SET reminder_eligible=false[^;]+;/)[0]);
  assert.equal((await ok()).tasks[0].reminderActive, false);
  await at(morning);
  assert.equal((await jobs()).length, 0);
  t = await updated(t, {
    notes: 'Unrelated edit',
    dueDate: '2020-01-01',
    reminderBefore: false,
    reminderAfter: false,
  });
  await at(morning);
  assert.equal((await notices()).length, 0);
  t = await updated(t, { reminderAfter: true });
  assert.equal(t.reminderActive, true);
  await at(morning);
  assert.equal((await notices()).length, 1);
  assert.equal((await jobs()).find((j) => j.state === 'delivered').day_offset, 1);
  let another = await task(b, 'Another legacy', { dueDate: '2020-01-02', assigneeIds: [owner] });
  await admin.query('UPDATE task SET reminder_eligible=false WHERE id=$1', [another.id]);
  another = await updated(another, { dueDate: '2020-01-03' });
  assert.equal(another.reminderActive, true);
  await at(morning);
  assert.equal((await notices()).length, 2);
});

test('templates reset optional reminders and dates while preserving source and legacy snapshot compatibility', async () => {
  const b = await board();
  let t = await task(b, 'Source', { dueDate: due, assigneeIds: [owner] });
  t = await updated(t, { reminderBefore: true, reminderAfter: true });
  const saved = (await templateOK(save('board', b))).template;
  const copied = await templateOK(use(saved, { name: 'Copy' }));
  const copy = (await ok()).tasks.find((x) => x.boardId === copied.boardId);
  assert.equal(copy.reminderBefore, false);
  assert.equal(copy.reminderAfter, false);
  assert.equal(copy.reminderActive, false);
  assert.equal(copy.dueDate, null);
  assert.equal((await ok()).tasks.find((x) => x.id === t.id).reminderBefore, true);
});

test('real migration 010 to 011 preserves existing tasks and activates only today and future deadlines', async () => {
  const directory = await mkdtemp(`${localRoot}tests/reminder-migrations-`);
  for (const name of (await readdir(migrationsDirectory)).filter((name) => /^00|^010_/.test(name)))
    await copyFile(`${migrationsDirectory}/${name}`, `${directory}/${name}`);
  await admin.query('CREATE DATABASE reminder_migration_test');
  const legacy = createDatabase(local.adminUrl.replace('/workspace_development', '/reminder_migration_test'));
  try {
    await migrate(legacy, directory);
    const w = (await legacy.query("INSERT INTO workspace(name) VALUES('Legacy') RETURNING id")).rows[0].id;
    const b = (
      await legacy.query("INSERT INTO board(workspace_id,name) VALUES($1,'Legacy') RETURNING id", [w])
    ).rows[0].id;
    const g = (
      await legacy.query(
        "INSERT INTO board_group(workspace_id,board_id,name) VALUES($1,$2,'Tasks') RETURNING id",
        [w, b],
      )
    ).rows[0].id;
    await legacy.query(
      `INSERT INTO task(workspace_id,board_id,group_id,title,due_date,notes) SELECT $1,$2,$3,'Deadline '||offset_days, (now() AT TIME ZONE 'Europe/Athens')::date+offset_days,'Preserve me' FROM (VALUES(-1),(0),(1)) days(offset_days)`,
      [w, b, g],
    );
    const original = (
      await legacy.query('SELECT id,title,due_date,notes,revision FROM task ORDER BY due_date')
    ).rows;
    assert.deepEqual(await migrate(legacy), ['011_task_reminders.sql', '012_task_recurrence.sql']);
    assert.deepEqual(
      (await legacy.query('SELECT id,title,due_date,notes,revision FROM task ORDER BY due_date')).rows,
      original,
    );
    assert.deepEqual(
      (await legacy.query('SELECT reminder_eligible FROM task ORDER BY due_date')).rows.map(
        (r) => r.reminder_eligible,
      ),
      [false, true, true],
    );
    assert.deepEqual(await migrate(legacy), []);
  } finally {
    await legacy.end();
    await admin.query('DROP DATABASE reminder_migration_test');
  }
});

test('disabled optional jobs catch up once on re-enable and supersede an older pending occurrence', async () => {
  const b = await board();
  let t = await task(b, 'Options', { dueDate: due, assigneeIds: [owner] });
  t = await updated(t, { reminderBefore: true, reminderAfter: true });
  await at('2030-03-30T06:00:00Z');
  t = await updated(t, { reminderBefore: false, reminderAfter: false });
  await at('2030-04-02T06:00:00Z');
  assert.equal((await notices()).length, 1);
  t = await updated(t, { reminderBefore: true, reminderAfter: true });
  await at('2030-04-02T06:01:00Z');
  assert.equal((await notices()).length, 2);
  assert.deepEqual(
    (await jobs()).map((j) => j.state),
    ['superseded', 'delivered', 'delivered'],
  );
});

test('database terminates a worker after its insert and recovery produces one committed notification', async () => {
  const b = await board();
  await task(b, 'Interrupted', { dueDate: due, assigneeIds: [owner] });
  await at('2030-03-30T06:00:00Z');
  const crashingPool = {
    query: (...args) => pool.query(...args),
    connect: async () => {
      const client = await pool.connect();
      client.on('error', () => {});
      const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      return {
        query: async (sql, params) => {
          if (sql.startsWith("UPDATE task_reminder_job SET state='delivered'")) {
            await admin.query('SELECT pg_terminate_backend($1)', [pid]);
            throw new Error('Simulated worker connection interruption after recipient insert');
          }
          return client.query(sql, params);
        },
        release: () => client.release(true),
      };
    },
  };
  await assert.rejects(runJobs(crashingPool, { now: morning }));
  assert.equal((await notices()).length, 0);
  assert.equal((await jobs())[0].state, 'pending');
  assert.equal((await at(morning)).delivered, 1);
  await at(morning);
  assert.equal((await notices()).length, 1);
});
