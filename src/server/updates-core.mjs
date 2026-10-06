import { WorkError, withMember } from './work-core.mjs';
const fail = (status, message) => { throw new WorkError(status, message); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursor = value => {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) fail(400, 'Choose a valid update.');
  return value;
};

// Canonical persisted values make retries, reordered assignment arrays, and
// normalized checklist/field submissions compare by meaning, not request shape.
export async function taskActivityState(c, workspace, taskId) {
  return (await c.query(`SELECT t.id,t.board_id,t.revision,t.title,t.status,t.priority,
    to_char(t.due_date,'YYYY-MM-DD') AS "dueDate",t.group_id AS "group",t.parent_id AS "parent",t.position,t.notes,
    ARRAY(SELECT a.user_id FROM task_assignee a WHERE a.workspace_id=t.workspace_id AND a.task_id=t.id ORDER BY a.user_id) AS assignees,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'done',i.done,'position',i.position) ORDER BY i.id) FROM checklist_item i WHERE i.workspace_id=t.workspace_id AND i.task_id=t.id),'[]'::jsonb) AS checklist,
    coalesce((SELECT jsonb_agg(jsonb_build_object('columnId',v.column_id,'value',v.value) ORDER BY v.column_id) FROM task_field_value v WHERE v.workspace_id=t.workspace_id AND v.task_id=t.id),'[]'::jsonb) AS fields
    FROM task t WHERE t.workspace_id=$1 AND t.id=$2`, [workspace,taskId])).rows[0];
}
export async function recordTaskActivity(c, member, before, after) {
  const fieldNames = ['title','status','priority','dueDate','group','parent','position','notes','assignees','checklist','fields'];
  const changed = before ? fieldNames.filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])) : ['created'];
  if (!changed.length) return;
  const descriptions = changed.map(key => {
    if (key === 'status') return `status from ${before.status} to ${after.status}`;
    if (key === 'priority') return `priority from ${before.priority} to ${after.priority}`;
    if (key === 'dueDate') return `due date from ${before.dueDate ?? 'none'} to ${after.dueDate ?? 'none'}`;
    return ({title:'title',group:'group',parent:'parent task',position:'task order',notes:'notes',assignees:'assignees',checklist:'checklist',fields:'custom fields'})[key];
  });
  const summary = before ? `Changed ${descriptions.join(', ')}.` : 'Created this task.';
  const activity = (await c.query(`INSERT INTO task_activity(workspace_id,task_id,revision,event,actor_id,actor_name,summary,changed_fields)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [member.workspace_id,after.id,after.revision,before?'updated':'created',member.id,member.name,summary,changed])).rows[0];
  // Pure reordering is history, but not an interruption for every assignee.
  const meaningful = changed.some(key => key !== 'position');
  if (!meaningful) return;
  const oldAssignees = before?.assignees ?? [], newAssignees = after.assignees;
  const recipients = [...new Set([...oldAssignees,...newAssignees])].filter(value => value !== member.id);
  for (const recipient of recipients) {
    const notificationSummary = !newAssignees.includes(recipient) ? 'You were unassigned from this task.'
      : !oldAssignees.includes(recipient) ? 'You were assigned to this task.' : summary;
    await c.query(`INSERT INTO task_notification(workspace_id,activity_id,recipient_id,summary)
      SELECT $1,$2,m.user_id,$4 FROM membership m JOIN app_user u ON u.id=m.user_id
      WHERE m.workspace_id=$1 AND m.user_id=$3 AND u.disabled_at IS NULL`, [member.workspace_id,activity.id,recipient,notificationSummary]);
  }
}
export function readUpdates(pool, auth, headers, query = {}) {
  return withMember(pool, auth, headers, false, async (c, member) => {
    const before = query.before == null ? null : cursor(query.before);
    const taskId = query.taskId;
    if (taskId != null && (typeof taskId !== 'string' || !uuid.test(taskId))) fail(400,'Choose a valid task.');
    if (taskId != null && !(await c.query('SELECT id FROM task WHERE workspace_id=$1 AND id=$2',[member.workspace_id,taskId])).rowCount) fail(404,'Task not found.');
    const rows = taskId != null
      ? (await c.query(`SELECT a.id::text,t.id AS "taskId",t.board_id AS "boardId",t.title AS "taskTitle",
        a.actor_name AS "actorName",a.summary,a.created_at AS "createdAt" FROM task_activity a
        JOIN task t ON t.workspace_id=a.workspace_id AND t.id=a.task_id
        WHERE a.workspace_id=$1 AND a.task_id=$2 AND ($3::bigint IS NULL OR a.id<$3)
        ORDER BY a.id DESC LIMIT 26`,[member.workspace_id,taskId,before])).rows
      : (await c.query(`SELECT n.id::text,t.id AS "taskId",t.board_id AS "boardId",t.title AS "taskTitle",
        a.actor_name AS "actorName",n.summary,a.created_at AS "createdAt",n.read_at AS "readAt"
        FROM task_notification n JOIN task_activity a ON a.workspace_id=n.workspace_id AND a.id=n.activity_id
        JOIN task t ON t.workspace_id=a.workspace_id AND t.id=a.task_id
        WHERE n.workspace_id=$1 AND n.recipient_id=$2 AND ($3::bigint IS NULL OR n.id<$3)
        ORDER BY n.id DESC LIMIT 26`,[member.workspace_id,member.id,before])).rows;
    const items = rows.slice(0,25).map(row => ({...row,createdAt:row.createdAt.toISOString(),...('readAt' in row ? {readAt:row.readAt?.toISOString() ?? null} : {})}));
    return {items,nextCursor:rows.length>25 ? items.at(-1).id : null};
  });
}
export function manageUpdates(pool, auth, headers, input) {
  // Read-state is personal: viewers may change it, never workspace work.
  return withMember(pool, auth, headers, true, async (c,member) => {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['action','id','read'].includes(key)) || input.action !== 'setRead' || typeof input.read !== 'boolean') fail(400,'Choose a valid update action.');
    const updated = await c.query(`UPDATE task_notification SET read_at=CASE WHEN $4 THEN coalesce(read_at,now()) ELSE NULL END
      WHERE workspace_id=$1 AND recipient_id=$2 AND id=$3 RETURNING id`,[member.workspace_id,member.id,cursor(input.id),input.read]);
    if (!updated.rowCount) fail(404,'Update not found.');
    return {ok:true};
  }, true);
}
