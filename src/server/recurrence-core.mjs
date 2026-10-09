import { randomUUID } from 'node:crypto';
import { WorkError } from './work-core.mjs';
import { calendarWindow, occurrenceDate, localDate, validDate } from './recurrence-calendar.mjs';

const fail = (status, message) => {
  throw new WorkError(status, message);
};
const columns = `r.*,to_char(r.anchor_date,'YYYY-MM-DD') AS anchor,to_char(r.next_date,'YYYY-MM-DD') AS next`;
export const recurrenceSnapshotSQL = `(SELECT jsonb_build_object(
  'id',r.id,'sourceTaskId',r.source_task_id,'mode',r.mode,'unit',r.unit,'interval',r.interval_count,
  'timeZone',r.time_zone,'enabled',r.enabled,'anchorDate',to_char(r.anchor_date,'YYYY-MM-DD'),
  'nextDate',to_char(r.next_date,'YYYY-MM-DD'),'isSource',r.source_task_id=t.id,
  'state',CASE WHEN NOT r.enabled THEN 'paused' WHEN r.attempts>=5 THEN 'failed'
    WHEN r.mode='completion' AND r.pending_completion_at IS NULL THEN 'waiting' ELSE 'active' END)
  FROM task_recurrence_occurrence o JOIN task_recurrence r ON r.workspace_id=o.workspace_id AND r.id=o.series_id
  WHERE o.workspace_id=t.workspace_id AND o.task_id=t.id)`;
export const recurrenceActivitySQL = `(SELECT jsonb_build_object('mode',r.mode,'unit',r.unit,'interval',r.interval_count,
  'timeZone',r.time_zone,'enabled',r.enabled,'anchorDate',to_char(r.anchor_date,'YYYY-MM-DD'),'recipeVersion',r.recipe_version)
  FROM task_recurrence r WHERE r.workspace_id=t.workspace_id AND r.source_task_id=t.id)`;

async function recipe(c, workspace, taskId) {
  const t = (
    await c.query(
      `SELECT id,board_id AS "boardId",group_id AS "groupId",title,notes,priority,
    reminder_before AS "reminderBefore",reminder_after AS "reminderAfter" FROM task WHERE workspace_id=$1 AND id=$2`,
      [workspace, taskId],
    )
  ).rows[0];
  t.assignees = (
    await c.query('SELECT user_id FROM task_assignee WHERE workspace_id=$1 AND task_id=$2 ORDER BY user_id', [
      workspace,
      taskId,
    ])
  ).rows.map((r) => r.user_id);
  t.checklist = (
    await c.query(
      'SELECT label,position FROM checklist_item WHERE workspace_id=$1 AND task_id=$2 ORDER BY position,id',
      [workspace, taskId],
    )
  ).rows;
  t.fields = (
    await c.query(
      `SELECT v.column_id AS "columnId",v.value,d.kind,d.configuration FROM task_field_value v
    JOIN column_definition d ON d.workspace_id=v.workspace_id AND d.id=v.column_id
    WHERE v.workspace_id=$1 AND v.task_id=$2 AND d.kind IN ('text','number') ORDER BY d.id`,
      [workspace, taskId],
    )
  ).rows;
  if (Buffer.byteLength(JSON.stringify(t)) > 200_000)
    fail(400, 'This recurring task is too large. Shorten its notes or checklist.');
  return t;
}
async function zone(c, value) {
  if (
    typeof value !== 'string' ||
    value.length > 100 ||
    (value !== 'UTC' && !/^[A-Za-z_]+\/[A-Za-z0-9_+\-/]+$/.test(value))
  )
    fail(400, 'Choose a named timezone.');
  try {
    localDate(new Date(), value);
  } catch {
    fail(400, 'Choose a supported timezone.');
  }
  if (!(await c.query('SELECT 1 FROM pg_timezone_names WHERE name=$1', [value])).rowCount)
    fail(400, 'Choose a supported timezone.');
  return value;
}
async function readSeries(c, workspace, taskId) {
  return (
    await c.query(
      `SELECT ${columns} FROM task_recurrence r JOIN task_recurrence_occurrence o
    ON o.workspace_id=r.workspace_id AND o.series_id=r.id WHERE o.workspace_id=$1 AND o.task_id=$2`,
      [workspace, taskId],
    )
  ).rows[0];
}

// Runs after the source's field/assignment/checklist changes in the same edit
// transaction, so explicit recipe refresh captures exactly the saved draft.
export async function configureRecurrence(c, member, taskId, input) {
  if (input == null) return;
  if (
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (k) =>
        !['mode', 'unit', 'interval', 'timeZone', 'enabled', 'anchorDate', 'refreshTemplate'].includes(k),
    )
  )
    fail(400, 'Choose valid recurrence settings.');
  const workspace = member.workspace_id;
  const existing = await readSeries(c, workspace, taskId);
  if (existing && existing.source_task_id !== taskId) fail(400, 'Change the recurrence on its source task.');
  if (!existing && input.enabled === false) return;
  const task = (
    await c.query(
      "SELECT *,to_char(due_date,'YYYY-MM-DD') AS date FROM task WHERE workspace_id=$1 AND id=$2",
      [workspace, taskId],
    )
  ).rows[0];
  const mode = input.mode ?? existing?.mode ?? 'calendar',
    unit = input.unit ?? existing?.unit ?? 'week',
    interval = input.interval ?? existing?.interval_count ?? 1;
  if (
    !['calendar', 'completion'].includes(mode) ||
    !['day', 'week', 'month'].includes(unit) ||
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 365
  )
    fail(400, 'Choose a daily, weekly or monthly interval from 1 to 365.');
  for (const key of ['enabled', 'refreshTemplate'])
    if (key in input && typeof input[key] !== 'boolean') fail(400, 'Choose valid recurrence settings.');
  const timeZone = await zone(c, input.timeZone ?? existing?.time_zone ?? 'Europe/Athens');
  const now = (await c.query('SELECT clock_timestamp() AS now')).rows[0].now;
  const today = localDate(now, timeZone);
  const anchor = input.anchorDate ?? existing?.anchor ?? task.date ?? today;
  if (!validDate(anchor)) fail(400, 'Choose a valid recurrence anchor date.');
  if ((!existing || existing.mode !== mode) && mode === 'calendar' && !task.date)
    fail(400, 'Choose a due date before enabling calendar recurrence.');
  if (!existing && mode === 'calendar' && anchor !== task.date)
    fail(400, 'The first recurrence anchor must match the source due date.');
  // Validate at least one successor without allowing a near-calendar-end poison job.
  try {
    occurrenceDate(anchor, unit, interval);
  } catch {
    fail(400, 'Choose an anchor with a supported next occurrence.');
  }
  const enabled = input.enabled ?? existing?.enabled ?? true;
  const changed =
    !existing ||
    mode !== existing.mode ||
    unit !== existing.unit ||
    interval !== existing.interval_count ||
    timeZone !== existing.time_zone ||
    anchor !== existing.anchor;
  const captured =
    !existing || input.refreshTemplate === true ? await recipe(c, workspace, taskId) : existing.recipe;
  const window = calendarWindow(anchor, unit, interval, today);
  // Initial setup allows one latest missed occurrence; edits are prospective.
  const nextIndex = existing && changed ? window.nextIndex : (existing?.next_index ?? 1);
  const nextDate =
    mode === 'calendar'
      ? occurrenceDate(anchor, unit, interval, nextIndex)
      : existing?.mode === 'completion' && existing.pending_completion_at
        ? occurrenceDate(localDate(existing.pending_completion_at, timeZone), unit, interval)
        : null;
  if (!existing) {
    const series = (
      await c.query(
        `INSERT INTO task_recurrence(workspace_id,source_task_id,mode,unit,interval_count,time_zone,anchor_date,enabled,recipe,next_index,next_date,latest_task_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$2) RETURNING id`,
        [
          workspace,
          taskId,
          mode,
          unit,
          interval,
          timeZone,
          anchor,
          enabled,
          JSON.stringify(captured),
          nextIndex,
          nextDate,
        ],
      )
    ).rows[0];
    await c.query(
      'INSERT INTO task_recurrence_occurrence(workspace_id,series_id,task_id,scheduled_date,occurrence_key) VALUES($1,$2,$3,$4,$5)',
      [workspace, series.id, taskId, task.date ?? anchor, `calendar:${task.date ?? anchor}`],
    );
    return;
  }
  const reset = changed || input.refreshTemplate === true || (!existing.enabled && enabled);
  await c.query(
    `UPDATE task_recurrence SET mode=$3,unit=$4,interval_count=$5,time_zone=$6,anchor_date=$7,enabled=$8,
    recipe=$9::jsonb,recipe_version=recipe_version+$10,next_index=$11,
    next_date=CASE WHEN $12 THEN $13::date ELSE next_date END,
    pending_predecessor_id=CASE WHEN $15 THEN NULL ELSE pending_predecessor_id END,
    pending_completion_at=CASE WHEN $15 THEN NULL ELSE pending_completion_at END,
    attempts=CASE WHEN $14 THEN 0 ELSE attempts END,last_error_code=CASE WHEN $14 THEN NULL ELSE last_error_code END,
    next_attempt_at=CASE WHEN $14 THEN now() ELSE next_attempt_at END
    WHERE workspace_id=$1 AND id=$2`,
    [
      workspace,
      existing.id,
      mode,
      unit,
      interval,
      timeZone,
      anchor,
      enabled,
      JSON.stringify(captured),
      input.refreshTemplate === true ? 1 : 0,
      nextIndex,
      changed,
      nextDate,
      reset,
      mode !== existing.mode,
    ],
  );
}

// Genuine task transitions are captured at commit time, never reconstructed from
// status or updated_at. Each occurrence can start at most one successor chain.
export async function recurrenceCompleted(c, workspace, taskId, beforeStatus, afterStatus) {
  if (beforeStatus === 'Done' || afterStatus !== 'Done') return;
  const series = await readSeries(c, workspace, taskId);
  if (!series) return;
  const completed = (
    await c.query(
      `UPDATE task_recurrence_occurrence SET completed_at=clock_timestamp()
    WHERE workspace_id=$1 AND task_id=$2 AND completed_at IS NULL RETURNING completed_at`,
      [workspace, taskId],
    )
  ).rows[0];
  if (
    !completed ||
    series.mode !== 'completion' ||
    series.latest_task_id !== taskId ||
    series.pending_predecessor_id
  )
    return;
  const date = occurrenceDate(
    localDate(completed.completed_at, series.time_zone),
    series.unit,
    series.interval_count,
  );
  await c.query(
    `UPDATE task_recurrence SET pending_predecessor_id=$3,pending_completion_at=$4,next_date=$5,next_attempt_at=now()
    WHERE workspace_id=$1 AND id=$2`,
    [workspace, series.id, taskId, completed.completed_at, date],
  );
}
export async function pauseArchivedRecurrence(c, workspace) {
  await c.query(
    `UPDATE task_recurrence r SET enabled=false FROM task t JOIN board b ON b.workspace_id=t.workspace_id AND b.id=t.board_id
    WHERE r.workspace_id=$1 AND r.workspace_id=t.workspace_id AND r.source_task_id=t.id
    AND (t.archived_at IS NOT NULL OR b.archived_at IS NOT NULL) AND r.enabled`,
    [workspace],
  );
}

async function materialize(c, series, date, now) {
  const key =
    series.mode === 'completion' ? `completion:${series.pending_predecessor_id}` : `calendar:${date}`;
  const existing = (
    await c.query(
      'SELECT task_id FROM task_recurrence_occurrence WHERE series_id=$1 AND (occurrence_key=$2 OR ($3 AND scheduled_date=$4)) ORDER BY created_at DESC LIMIT 1',
      [series.id, key, series.mode === 'calendar', date],
    )
  ).rows[0];
  if (existing) return { id: existing.task_id, created: false };
  const r = series.recipe;
  const destination = (
    await c.query(
      `SELECT g.id FROM board_group g JOIN board b ON b.workspace_id=g.workspace_id AND b.id=g.board_id
    WHERE g.workspace_id=$1 AND g.board_id=$2 AND g.id=$3 AND b.archived_at IS NULL`,
      [series.workspace_id, r.boardId, r.groupId],
    )
  ).rows[0];
  if (!destination) throw Object.assign(new Error('Recurrence destination unavailable.'), { code: 'RDEST' });
  for (const field of r.fields) {
    const definition = (
      await c.query(
        'SELECT kind,configuration FROM column_definition WHERE workspace_id=$1 AND board_id=$2 AND id=$3',
        [series.workspace_id, r.boardId, field.columnId],
      )
    ).rows[0];
    if (
      !definition ||
      definition.kind !== field.kind ||
      JSON.stringify(definition.configuration) !== JSON.stringify(field.configuration)
    )
      throw Object.assign(new Error('Recurrence column definition changed.'), { code: 'RFILD' });
  }
  const users = (
    await c.query(
      `SELECT u.id FROM app_user u JOIN membership m ON m.user_id=u.id
    WHERE m.workspace_id=$1 AND u.id=ANY($2::text[]) AND u.disabled_at IS NULL ORDER BY u.id FOR SHARE OF u`,
      [series.workspace_id, r.assignees],
    )
  ).rows;
  const id = randomUUID();
  await c.query(
    `INSERT INTO task(id,workspace_id,board_id,group_id,title,notes,priority,due_date,reminder_before,reminder_after,position)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce(max(position),-1)+1 FROM task WHERE workspace_id=$2 AND board_id=$3`,
    [
      id,
      series.workspace_id,
      r.boardId,
      r.groupId,
      r.title,
      r.notes,
      r.priority,
      date,
      r.reminderBefore,
      r.reminderAfter,
    ],
  );
  for (const user of users)
    await c.query('INSERT INTO task_assignee(workspace_id,task_id,user_id) VALUES($1,$2,$3)', [
      series.workspace_id,
      id,
      user.id,
    ]);
  for (const item of r.checklist)
    await c.query('INSERT INTO checklist_item(workspace_id,task_id,label,position) VALUES($1,$2,$3,$4)', [
      series.workspace_id,
      id,
      item.label,
      item.position,
    ]);
  for (const field of r.fields)
    await c.query(
      'INSERT INTO task_field_value(workspace_id,board_id,task_id,column_id,value) VALUES($1,$2,$3,$4,$5::jsonb)',
      [series.workspace_id, r.boardId, id, field.columnId, JSON.stringify(field.value)],
    );
  await c.query(
    'INSERT INTO task_recurrence_occurrence(workspace_id,series_id,task_id,scheduled_date,occurrence_key) VALUES($1,$2,$3,$4,$5)',
    [series.workspace_id, series.id, id, date, key],
  );
  const activity = (
    await c.query(
      `INSERT INTO task_activity(workspace_id,task_id,revision,event,actor_id,actor_name,summary,changed_fields,created_at)
    VALUES($1,$2,1,'recurrence_created',NULL,'Recurrence','Created this recurring task.',ARRAY['created'],$3) RETURNING id`,
      [series.workspace_id, id, now],
    )
  ).rows[0];
  for (const user of users)
    await c.query(
      `INSERT INTO task_notification(workspace_id,activity_id,recipient_id,summary) VALUES($1,$2,$3,'You were assigned to this recurring task.')`,
      [series.workspace_id, activity.id, user.id],
    );
  return { id, created: true };
}
async function generate(c, series, now) {
  let created = 0;
  if (series.mode === 'completion') {
    if (!series.pending_completion_at) return 0;
    // Freeze the due date at the genuine completion transition. Later unrelated
    // edits cannot slide it forward; explicit cadence changes recalculate it from
    // the same completion event, while a mode switch clears the old queue.
    const task = await materialize(c, series, series.next, now);
    await c.query(
      `UPDATE task_recurrence SET latest_task_id=$2,pending_predecessor_id=NULL,pending_completion_at=NULL,next_date=NULL WHERE id=$1`,
      [series.id, task.id],
    );
    return task.created ? 1 : 0;
  }
  const today = localDate(now, series.time_zone);
  const window = calendarWindow(series.anchor, series.unit, series.interval_count, today);
  let index = series.next_index,
    latest = series.latest_task_id;
  if (window.latestIndex !== null && window.latestIndex >= index) {
    const date = occurrenceDate(series.anchor, series.unit, series.interval_count, window.latestIndex);
    const task = await materialize(c, series, date, now);
    created += Number(task.created);
    latest = task.id;
    index = window.latestIndex + 1;
  }
  const future = (
    await c.query(
      `SELECT task_id,to_char(scheduled_date,'YYYY-MM-DD') AS date FROM task_recurrence_occurrence
    WHERE series_id=$1 AND scheduled_date>$2 ORDER BY scheduled_date,created_at DESC LIMIT 1`,
      [series.id, today],
    )
  ).rows[0];
  let next = future?.date;
  if (future) latest = future.task_id;
  if (!future) {
    index = Math.max(index, window.nextIndex);
    next = occurrenceDate(series.anchor, series.unit, series.interval_count, index);
    const task = await materialize(c, series, next, now);
    created += Number(task.created);
    latest = task.id;
    index++;
  }
  await c.query('UPDATE task_recurrence SET next_index=$2,next_date=$3,latest_task_id=$4 WHERE id=$1', [
    series.id,
    index,
    next,
    latest,
  ]);
  return created;
}

// Called inside jobs-core's already-held workspace transaction. One series is a
// bounded atomic unit (latest missed + one future), with no external effects.
export async function runRecurrences(c, workspace, now, limit = 50) {
  const result = { recurrenceCreated: 0, recurrenceRetried: 0, recurrenceFailed: 0, recurrenceExamined: 0 };
  await pauseArchivedRecurrence(c, workspace);
  const series = (
    await c.query(
      `SELECT ${columns} FROM task_recurrence r WHERE workspace_id=$1 AND enabled AND attempts<5
    AND next_attempt_at<=$2 ORDER BY next_attempt_at,id LIMIT $3`,
      [workspace, now, limit],
    )
  ).rows;
  for (const item of series) {
    result.recurrenceExamined++;
    await c.query('SAVEPOINT recurrence_generation');
    try {
      const created = await generate(c, item, now);
      await c.query(
        "UPDATE task_recurrence SET attempts=0,last_error_code=NULL,next_attempt_at=$2::timestamptz+interval '30 seconds' WHERE id=$1",
        [item.id, now],
      );
      await c.query('RELEASE SAVEPOINT recurrence_generation');
      result.recurrenceCreated += created;
    } catch (error) {
      await c.query('ROLLBACK TO SAVEPOINT recurrence_generation');
      const attempts = item.attempts + 1;
      const code = /^[A-Z0-9]{5}$/.test(error.code ?? '') ? error.code : 'ERROR';
      await c.query(
        "UPDATE task_recurrence SET attempts=$2,last_error_code=$3,next_attempt_at=$4::timestamptz+($5*interval '1 second') WHERE id=$1",
        [item.id, attempts, code, now, 30 * 2 ** (attempts - 1)],
      );
      await c.query('RELEASE SAVEPOINT recurrence_generation');
      result[attempts >= 5 ? 'recurrenceFailed' : 'recurrenceRetried']++;
    }
  }
  return result;
}
