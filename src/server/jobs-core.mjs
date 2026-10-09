import { transaction } from './database.mjs';

const maximumAttempts = 5;
// All timing is calculated from date-only work in PostgreSQL's Athens timezone.
// Durable rows are also the delivery ledger: never delete/recreate a delivered
// or superseded occurrence when dates, assignments or archive state change.
async function reconcile(c, workspace, now) {
  await c.query(
    `INSERT INTO task_reminder_job(workspace_id,task_id,due_date,day_offset,scheduled_at,next_attempt_at)
     SELECT t.workspace_id,t.id,t.due_date,o.day_offset,
       ((t.due_date+o.day_offset)+time '09:00') AT TIME ZONE 'Europe/Athens',
       ((t.due_date+o.day_offset)+time '09:00') AT TIME ZONE 'Europe/Athens'
     FROM task t CROSS JOIN (VALUES (-1),(0),(1)) o(day_offset)
     WHERE t.workspace_id=$1 AND t.due_date IS NOT NULL AND t.reminder_eligible
       AND (o.day_offset=0 OR (o.day_offset=-1 AND t.reminder_before) OR (o.day_offset=1 AND t.reminder_after))
     ON CONFLICT(task_id,due_date,day_offset) DO NOTHING`,
    [workspace],
  );
  // Cancellation is reversible while delivery/supersession is permanent. A
  // completed task reopened later can catch up once, but never deliver twice.
  await c.query(
    `UPDATE task_reminder_job j SET state=CASE WHEN
       t.reminder_eligible AND t.due_date=j.due_date AND t.status<>'Done'
       AND t.archived_at IS NULL AND b.archived_at IS NULL
       AND (j.day_offset=0 OR (j.day_offset=-1 AND t.reminder_before) OR (j.day_offset=1 AND t.reminder_after))
       THEN 'pending' ELSE 'cancelled' END
     FROM task t JOIN board b ON b.workspace_id=t.workspace_id AND b.id=t.board_id
     WHERE j.workspace_id=$1 AND t.workspace_id=j.workspace_id AND t.id=j.task_id
       AND j.state IN ('pending','cancelled')`,
    [workspace],
  );
  // Choose only the latest elapsed enabled occurrence, even if its retry is
  // delayed. Older misses must not flood the assignees after a long interruption.
  await c.query(
    `UPDATE task_reminder_job older SET state='superseded'
     WHERE older.workspace_id=$1 AND older.state IN ('pending','cancelled')
       AND EXISTS (SELECT 1 FROM task_reminder_job newer
         WHERE newer.task_id=older.task_id AND newer.due_date=older.due_date
           AND newer.scheduled_at>older.scheduled_at AND newer.scheduled_at<=$2
           AND newer.state IN ('pending','delivered','failed'))`,
    [workspace, now],
  );
}

async function deliver(c, job, now) {
  // Workspace mutations already hold the workspace row. The second lock is the
  // same app_user SHARE lock used by writes; a prior operator disable is waited
  // for and rechecked by READ COMMITTED before any private notification appears.
  const recipients = (
    await c.query(
      `SELECT u.id FROM app_user u JOIN membership m ON m.user_id=u.id
       JOIN task_assignee a ON a.workspace_id=m.workspace_id AND a.user_id=u.id
       WHERE a.workspace_id=$1 AND a.task_id=$2 AND u.disabled_at IS NULL
       ORDER BY u.id FOR SHARE OF u`,
      [job.workspace_id, job.task_id],
    )
  ).rows;
  // No active assignees yet: keep the occurrence available for later assignment.
  if (!recipients.length) return false;
  const summary =
    job.day_offset === -1
      ? `This task is due on ${job.dueDate} (day-before reminder).`
      : job.day_offset === 1
        ? `This task was due on ${job.dueDate} (overdue reminder).`
        : `This task is due on ${job.dueDate}.`;
  for (const recipient of recipients)
    await c.query(
      `INSERT INTO task_notification(workspace_id,reminder_job_id,recipient_id,summary)
       VALUES($1,$2,$3,$4) ON CONFLICT(reminder_job_id,recipient_id) DO NOTHING`,
      [job.workspace_id, job.id, recipient.id, summary],
    );
  await c.query(
    "UPDATE task_reminder_job SET state='delivered',delivered_at=$2,last_error_code=NULL WHERE id=$1",
    [job.id, now],
  );
  return true;
}

// Internal worker entry point. A crash rolls back its transaction; no expiring
// claim can strand a job or race with a slow worker. A bounded savepoint per job
// rolls back *all* recipient effects before persisting a retry. No user session,
// task revision, edit activity, public endpoint or external delivery is involved.
export async function runJobs(pool, { now = new Date(), maxJobs = 100 } = {}) {
  now = new Date(now);
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 1000)
    throw new Error('Invalid job run options.');
  const result = { delivered: 0, retried: 0, failed: 0, examined: 0 };
  const workspaces = (await pool.query('SELECT id FROM workspace ORDER BY id')).rows;
  for (const workspace of workspaces) {
    if (result.examined >= maxJobs) break;
    const batch = await transaction(pool, async (c) => {
      const counts = { delivered: 0, retried: 0, failed: 0, examined: 0 };
      const locked = await c.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE SKIP LOCKED', [
        workspace.id,
      ]);
      if (!locked.rowCount) return counts;
      await reconcile(c, workspace.id, now);
      const jobs = (
        await c.query(
          `SELECT *,to_char(due_date,'YYYY-MM-DD') AS "dueDate" FROM task_reminder_job
           WHERE workspace_id=$1 AND state='pending' AND scheduled_at<=$2 AND next_attempt_at<=$2
           ORDER BY next_attempt_at,id LIMIT $3`,
          [workspace.id, now, maxJobs - result.examined],
        )
      ).rows;
      for (const job of jobs) {
        counts.examined++;
        await c.query('SAVEPOINT reminder_delivery');
        try {
          if (await deliver(c, job, now)) counts.delivered++;
          else
            await c.query(
              "UPDATE task_reminder_job SET next_attempt_at=$2::timestamptz+interval '1 minute' WHERE id=$1",
              [job.id, now],
            );
          await c.query('RELEASE SAVEPOINT reminder_delivery');
        } catch (error) {
          await c.query('ROLLBACK TO SAVEPOINT reminder_delivery');
          const attempts = job.attempts + 1;
          const failed = attempts >= maximumAttempts;
          // Store only SQLSTATE, never an exception message or private payload.
          const code = /^[A-Z0-9]{5}$/.test(error.code ?? '') ? error.code : 'ERROR';
          await c.query(
            `UPDATE task_reminder_job SET attempts=$2,state=$3,last_error_code=$4,
             next_attempt_at=$5::timestamptz+($6*interval '1 second') WHERE id=$1`,
            [
              job.id,
              attempts,
              failed ? 'failed' : 'pending',
              code,
              now,
              Math.min(3600, 30 * 2 ** (attempts - 1)),
            ],
          );
          await c.query('RELEASE SAVEPOINT reminder_delivery');
          counts[failed ? 'failed' : 'retried']++;
        }
      }
      return counts;
    });
    for (const key of Object.keys(result)) result[key] += batch[key];
  }
  return result;
}
