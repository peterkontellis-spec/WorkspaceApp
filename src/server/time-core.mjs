import { withMember, WorkError } from './work-core.mjs';
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
const date = (value) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '0001-01-01' ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    fail(400, 'Choose a valid date.');
  return value;
};
const integer = (value, max, message) => {
  if (!Number.isInteger(value) || value < 1 || value > max) fail(400, message);
  return value;
};
const revision = (value) => integer(value, 2147483646, 'Reload this entry before saving.');
const seconds = (value) => integer(value, 86400, 'Enter a duration from 1 second to 24 hours.');
const notes = (value) => {
  if (typeof value !== 'string' || value.length > 2000 || value.includes('\0'))
    fail(400, 'Notes must be 2000 characters or fewer.');
  return value.trim();
};
const keys = (data, allowed) => {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).some((key) => !allowed.includes(key))
  )
    fail(400, 'This field is not available for editing.');
};
const fields = `e.id,e.task_id AS "taskId",t.board_id AS "boardId",t.title AS "taskTitle",b.name AS "boardName",e.user_id AS "userId",u.display_name AS "userName",e.kind,e.work_date::text AS "workDate",
  CASE WHEN e.kind='manual' THEN e.duration_seconds WHEN e.ended_at IS NULL THEN NULL ELSE coalesce(e.adjusted_seconds,extract(epoch FROM e.ended_at-e.started_at)::bigint) END::float8 AS "durationSeconds",
  (e.adjusted_seconds IS NOT NULL) AS adjusted,CASE WHEN e.ended_at IS NOT NULL THEN extract(epoch FROM e.ended_at-e.started_at)::float8 ELSE NULL END AS "originalSeconds",
  e.started_at AS "startedAt",e.ended_at AS "endedAt",e.notes,e.revision,e.voided_at AS "voidedAt",e.stop_reason AS "stopReason",e.created_at AS "createdAt"`;
const joins = `FROM time_entry e JOIN task t ON t.id=e.task_id JOIN board b ON b.id=t.board_id JOIN app_user u ON u.id=e.user_id`;
async function entry(c, workspace, entryId) {
  return (
    await c.query(`SELECT ${fields} ${joins} WHERE e.workspace_id=$1 AND e.id=$2`, [workspace, entryId])
  ).rows[0];
}
export async function readActiveTimer(c, member) {
  return (
    (
      await c.query(
        `SELECT ${fields} ${joins} WHERE e.workspace_id=$1 AND e.user_id=$2 AND e.kind='timer' AND e.ended_at IS NULL`,
        [member.workspace_id, member.id],
      )
    ).rows[0] ?? null
  );
}
async function activeTask(c, member, taskId, taskRevision) {
  const task = (
    await c.query(
      `SELECT t.revision,t.archived_at,b.archived_at AS board_archived FROM task t JOIN board b ON b.id=t.board_id WHERE t.id=$1 AND t.workspace_id=$2`,
      [taskId, member.workspace_id],
    )
  ).rows[0];
  if (!task) fail(404, 'Task not found.');
  if (task.archived_at || task.board_archived) fail(409, 'Restore the task and board before changing time.');
  if (taskRevision !== undefined && task.revision !== taskRevision)
    fail(409, 'This task changed. Reload before adding time.');
}
export async function manageTime(pool, auth, headers, input) {
  return withMember(pool, auth, headers, true, async (c, member) => {
    // The local account operator does not take a workspace lock. Holding the
    // user row prevents its disable trigger from missing an in-flight start.
    const enabled = await c.query('SELECT id FROM app_user WHERE id=$1 AND disabled_at IS NULL FOR SHARE', [
      member.id,
    ]);
    if (!enabled.rowCount) fail(401, 'Sign in required.');
    const serverNow = (await c.query(`SELECT date_trunc('second',clock_timestamp()) AS value`)).rows[0].value;
    const action = input.action;
    if (action === 'start' || action === 'add') {
      keys(
        input,
        action === 'start'
          ? ['action', 'creationId', 'taskId', 'taskRevision']
          : ['action', 'creationId', 'taskId', 'taskRevision', 'workDate', 'durationSeconds', 'notes'],
      );
      const creationId = uuid(input.creationId),
        taskId = uuid(input.taskId),
        taskRevision = revision(input.taskRevision);
      const kind = action === 'start' ? 'timer' : 'manual';
      const workDate = action === 'add' ? date(input.workDate) : null;
      const duration = action === 'add' ? seconds(input.durationSeconds) : null;
      const note = action === 'add' ? notes(input.notes ?? '') : '';
      const prior = (
        await c.query(
          `SELECT id,task_id,kind,revision,work_date::text AS work_date,duration_seconds,notes FROM time_entry WHERE workspace_id=$1 AND user_id=$2 AND creation_id=$3`,
          [member.workspace_id, member.id, creationId],
        )
      ).rows[0];
      if (prior) {
        if (prior.task_id !== taskId || prior.kind !== kind)
          fail(409, 'This save identifier belongs to a different entry.');
        if (
          action === 'add' &&
          (prior.revision !== 1 ||
            prior.work_date !== workDate ||
            prior.duration_seconds !== duration ||
            prior.notes !== note)
        )
          fail(
            409,
            'This entry was already saved with different details or changed later. Refresh the history before saving again.',
          );
        return { entry: await entry(c, member.workspace_id, prior.id), serverNow };
      }
      await activeTask(c, member, taskId, taskRevision);
      if (
        action === 'start' &&
        (
          await c.query(`SELECT id FROM time_entry WHERE user_id=$1 AND kind='timer' AND ended_at IS NULL`, [
            member.id,
          ])
        ).rowCount
      )
        fail(409, 'Stop your running timer before starting another.');
      let inserted;
      try {
        inserted = (
          await c.query(
            `INSERT INTO time_entry(workspace_id,task_id,user_id,creation_id,kind,work_date,duration_seconds,started_at,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [
              member.workspace_id,
              taskId,
              member.id,
              creationId,
              kind,
              workDate,
              duration,
              kind === 'timer' ? serverNow : null,
              note,
            ],
          )
        ).rows[0];
      } catch (error) {
        if (error.code === '23505') fail(409, 'A timer is already running. Reload to see it.');
        throw error;
      }
      return { entry: await entry(c, member.workspace_id, inserted.id), serverNow };
    }
    if (!['stop', 'update', 'void', 'restore'].includes(action)) fail(400, 'Choose a valid time action.');
    keys(input, action === 'update' ? ['action', 'id', 'revision', 'patch'] : ['action', 'id', 'revision']);
    const entryId = uuid(input.id),
      expectedRevision = revision(input.revision);
    const old = (
      await c.query(`SELECT * FROM time_entry WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [
        member.workspace_id,
        entryId,
      ])
    ).rows[0];
    if (!old) fail(404, 'Time entry not found.');
    if (old.user_id !== member.id) fail(403, 'You can only change your own time.');
    if (action === 'stop' && old.kind === 'timer' && old.ended_at)
      return { entry: await entry(c, member.workspace_id, entryId), serverNow };
    if (old.revision !== expectedRevision) fail(409, 'This time entry changed. Reload before saving.');
    if (action === 'stop') {
      if (old.kind !== 'timer') fail(400, 'This entry is not a timer.');
      await c.query(
        `UPDATE time_entry SET ended_at=greatest(started_at,$2),revision=revision+1,updated_at=$2 WHERE id=$1`,
        [entryId, serverNow],
      );
    } else {
      if (old.kind === 'timer' && !old.ended_at) fail(409, 'Stop the timer before changing its entry.');
      await activeTask(c, member, old.task_id);
      if (action === 'update') {
        keys(input.patch, ['workDate', 'durationSeconds', 'notes']);
        if (old.voided_at) fail(409, 'Restore this entry before correcting it.');
        const workDate = date(input.patch.workDate),
          duration = seconds(input.patch.durationSeconds),
          note = notes(input.patch.notes ?? old.notes);
        await c.query(
          `UPDATE time_entry SET work_date=$2,duration_seconds=CASE WHEN kind='manual' THEN $3::integer ELSE NULL END,adjusted_seconds=CASE WHEN kind='timer' THEN $3::integer ELSE NULL END,notes=$4,revision=revision+1,updated_at=$5 WHERE id=$1`,
          [entryId, workDate, duration, note, serverNow],
        );
      } else {
        const shouldVoid = action === 'void';
        if (Boolean(old.voided_at) !== shouldVoid)
          await c.query(`UPDATE time_entry SET voided_at=$2,revision=revision+1,updated_at=$3 WHERE id=$1`, [
            entryId,
            shouldVoid ? serverNow : null,
            serverNow,
          ]);
      }
    }
    return { entry: await entry(c, member.workspace_id, entryId), serverNow };
  });
}
export async function readTime(pool, auth, headers, params) {
  return withMember(pool, auth, headers, false, async (c, member) => {
    const from = date(params.get('from')),
      to = date(params.get('to')),
      zone = params.get('timeZone');
    if (to < from || (Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86400000 > 92)
      fail(400, 'Choose a date range of up to 93 days.');
    if (
      typeof zone !== 'string' ||
      zone.length > 100 ||
      !(await c.query('SELECT 1 FROM pg_timezone_names WHERE name=$1', [zone])).rowCount
    )
      fail(400, 'Choose a valid time zone.');
    const taskId = params.has('taskId') ? uuid(params.get('taskId')) : null;
    let cursorDate = null,
      cursorId = null;
    if (params.has('cursor')) {
      try {
        const raw = params.get('cursor');
        if (raw.length > 250) throw Error();
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString());
        if (
          !Array.isArray(parsed) ||
          parsed.length !== 2 ||
          typeof parsed[0] !== 'string' ||
          !Number.isFinite(Date.parse(parsed[0]))
        )
          throw Error();
        cursorDate = new Date(parsed[0]).toISOString();
        cursorId = uuid(parsed[1]);
      } catch {
        fail(400, 'Reload the time history.');
      }
    }
    const serverNow = (await c.query(`SELECT date_trunc('second',clock_timestamp()) AS value`)).rows[0].value;
    const values = [member.workspace_id, from, to, zone, taskId];
    const inRange = `e.workspace_id=$1 AND ($5::uuid IS NULL OR e.task_id=$5) AND
      ((e.work_date BETWEEN $2::date AND $3::date) OR
      (e.kind='timer' AND e.adjusted_seconds IS NULL AND e.ended_at IS NOT NULL AND e.started_at < (($3::date+1)::timestamp AT TIME ZONE $4) AND e.ended_at >= ($2::date::timestamp AT TIME ZONE $4)))`;
    const rows = (
      await c.query(
        `SELECT ${fields} ${joins} WHERE ${inRange} AND ($6::timestamptz IS NULL OR (e.created_at,e.id)<($6::timestamptz,$7::uuid)) ORDER BY e.created_at DESC,e.id DESC LIMIT 51`,
        [...values, cursorDate, cursorId],
      )
    ).rows;
    const more = rows.length > 50,
      entries = rows.slice(0, 50),
      last = entries.at(-1);
    const activeTimer = await readActiveTimer(c, member);
    const allocations = (
      await c.query(
        `WITH days AS (
      SELECT d::date AS day,d::date::timestamp AT TIME ZONE $4 AS start_at,(d::date+1)::timestamp AT TIME ZONE $4 AS end_at FROM generate_series($2::date::timestamp,$3::date::timestamp,interval '1 day') d
    ) SELECT e.task_id AS "taskId",t.title,t.board_id AS "boardId",b.name,days.day::text AS date,
      sum(CASE WHEN e.work_date IS NOT NULL THEN coalesce(e.adjusted_seconds,e.duration_seconds)
        ELSE greatest(0,extract(epoch FROM least(e.ended_at,days.end_at)-greatest(e.started_at,days.start_at))) END)::float8 AS seconds
      ${joins} JOIN days ON (e.work_date=days.day OR (e.work_date IS NULL AND e.started_at<days.end_at AND e.ended_at>days.start_at))
      WHERE ${inRange} AND e.voided_at IS NULL GROUP BY e.task_id,t.title,t.board_id,b.name,days.day ORDER BY days.day,t.title,e.task_id`,
        values,
      )
    ).rows;
    const tasks = new Map(),
      boards = new Map(),
      dates = new Map();
    let totalSeconds = 0;
    for (const item of allocations) {
      totalSeconds += item.seconds;
      const task = tasks.get(item.taskId) ?? {
        taskId: item.taskId,
        title: item.title,
        boardId: item.boardId,
        seconds: 0,
      };
      task.seconds += item.seconds;
      tasks.set(item.taskId, task);
      const board = boards.get(item.boardId) ?? { boardId: item.boardId, name: item.name, seconds: 0 };
      board.seconds += item.seconds;
      boards.set(item.boardId, board);
      dates.set(item.date, (dates.get(item.date) ?? 0) + item.seconds);
    }
    return {
      actor: { id: member.id, role: member.role },
      serverNow,
      activeTimer,
      entries,
      nextCursor: more
        ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString('base64url')
        : null,
      summary: {
        totalSeconds,
        byTask: [...tasks.values()],
        byBoard: [...boards.values()],
        byDate: [...dates].map(([date, seconds]) => ({ date, seconds })),
      },
    };
  });
}
