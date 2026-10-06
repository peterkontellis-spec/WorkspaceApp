# Task activity and in-app notifications — M3.3

Accounts-mode task details now include Activity. The topbar bell opens Notifications at `/notifications`; Go to search also finds that page. This is implemented with server/database evidence; browser acceptance remains pending in PENDING_CHECKS.md.

## What is recorded

Task creation and saved changes record actor, time, task revision and changed fields in the same transaction as the task. Status, priority and due-date transitions have bounded old/new descriptions. Other changes name the field (title, group, parent, order, notes, assignees, checklist or custom fields); note/checklist/custom-field contents are not copied. The task link/title uses the current saved task. Historical actor name is retained.

Existing tasks have no invented history: their next change starts recording. Board/group/column administration, attachment events and membership-driven assignment cleanup are outside this task-save history. History is not a tamper-proof compliance log and has no restore-old-version action. No automatic retention deletion is configured.

## Who is notified

- A new active assignee receives an assignment notification.
- Existing active assignees receive meaningful task-change notifications.
- A removed assignee receives an unassignment notification if still an active workspace member.
- The acting user never receives their own notification. Disabled users/nonmembers are excluded. Membership removal removes that member's notification rows.
- Pure order changes appear in history without notifying. No-op saves still advance the existing task revision but emit no activity or notifications.

Unique task-revision events and per-event recipients, existing creation idempotency, revision checks and transactional rollback prevent retry/conflict duplicates. Each user sees only their own notifications. All staff roles can read shared task history; viewers can mark their own notifications read/unread without gaining task-edit permission.

## Refresh and read state

The bell's unread count follows the existing visible/online snapshot refresh, normally five seconds after each completed read. Notification/activity lists fetch on opening and explicitly through Refresh; they do not reorder while being read. Older and Latest navigate bounded 25-item cursor pages, newest first. Opening a notification's task does not mark it read. Use Mark read/Mark unread; the bell catches up on its next successful poll. Read state persists in PostgreSQL.

Requests are cancellable, bounded by a 15-second client timeout, and ignore obsolete replies. On a transient error an existing list may remain visible with a stale warning; Refresh retries. Session/access loss clears the feed. These client behavior paths are source-reviewed and await actual browser checks.

## Storage and API

Additive migration `006_task_updates.sql` creates `task_activity` and `task_notification`, composite workspace/task/member constraints, uniqueness and pagination/unread indexes. Apply through the existing reviewed migration/grant procedure; never edit an applied migration. No external queue, broker or new dependency.

- `GET /api/updates`: current user's notification page.
- `GET /api/updates?taskId=<UUID>`: authorized task history.
- Optional `before=<positive bigint cursor>` selects older entries; responses include `items` and `nextCursor`.
- `POST /api/updates` with `{action:"setRead", id:"…", read:true|false}` changes only the caller's read state. Exact-origin JSON, bounded body and fresh session/membership checks apply. Passive reads do not extend idle sessions; deliberate writes do.

Eight new database cases and the full 67-test regression passed, including real restart, rollback, revocation, permissions and pagination. Production build/TypeScript, 42 behavioral tests and 21 HTTP smoke checks passed. See STATUS.md for evidence and PENDING_CHECKS.md for UI acceptance.

Due reminders follow the M4.2 scheduler. Email, phone push, comments and mentions remain outside this block. No NAS/resource or publication-readiness claim; the required pre-publication security audit is still ahead.
