# Deadline reminders and durable jobs

M4.2 locally verified, 9 October 2026. STATUS.md records executed checks; device, NAS and publication acceptance remain separate.

## User-visible behavior

- Dated tasks notify current assignees in the app at 09:00 Europe/Athens on the due date. Athens daylight-saving rules apply regardless of the browser or server timezone.
- Owners/editors can enable “One day before” and “One day overdue” in task details. Both run at 09:00 Athens and affect everyone assigned to the task. They start off and are saved with the task, with the same revision/conflict and draft protections as other fields.
- Viewers can see the saved choices. A due date and current, enabled assignees are required for delivery. Completed tasks and archived tasks/boards do not deliver reminders.
- On recovery from downtime, deliver only the latest missed eligible reminder for each task/deadline. Each delivered occurrence is recorded and will not repeat after another restart, a retry, reopening/restoring the task, or changing away from and back to that deadline.
- Delivery uses the current assignments and permissions. Previous recipients keep already delivered notifications and their private read state; changing assignments does not retroactively notify a new assignee for an already delivered occurrence.
- Existing deadlines before the feature's activation day are excluded from automatic backfill. Changing their date or enabling an extra reminder deliberately activates scheduling. Merely saving notes or another unchanged full-form field does not.
- Template copies start with fresh dates/assignees and the extra reminders off. Existing templates retain their immutable contents.

Notifications link to the task through the existing notification feed and unread bell. A system reminder is not a user edit: it does not alter task revisions or manufacture task-edit activity. There is no email, push notification, personal notification-settings page, recurring-task creation or arbitrary automation in M4.2.

## Execution and reliability

The app's Node startup hook runs a sequential worker when `WORKSPACE_JOBS_ENABLED=1`. The local preview enables it; explicit prototype mode does not. The worker uses a separate one-connection PostgreSQL pool and checks every 30 seconds. Delivery can therefore lag the scheduled time by a polling interval and by processing/recovery delays; this is not an exact-time alarm service. Browser tabs need not remain open. When the app process is stopped or the Mac sleeps, reminders wait in durable storage until it resumes.

The database owns due-date/offset identities, retry state and uniqueness. Worker dispatch shares the workspace and account locking protocol used by task/membership changes. Revalidate eligibility before writing notifications; commit notification effects and delivery state together. Competing workers must not duplicate effects. Retry failed deliveries up to five attempts with 30/60/120/240-second backoff between attempts; exhausted work must remain diagnosable rather than disappear or report success. The runtime logs fixed operational messages and aggregate counts, not task contents or credentials. The job records retain only a SQLSTATE or generic error code. Exhausted jobs remain failed, make worker readiness unavailable, and require an operator to inspect/fix the cause and deliberately requeue the affected occurrence; changing a date or option does not silently reset the exhausted occurrence.

Calendar calculations use PostgreSQL's named Europe/Athens timezone, including spring/autumn transitions. Persisted UTC instants establish dispatch order. No reminder-clock override or dispatch endpoint is exposed to browsers.

## Required evidence

Use isolated fictional databases/accounts and the existing separate-port browser harness. Required checks include persisted jobs and actual process/database restart; retry rollback and duplicate prevention; competing workers and access-disable races; current assignments, due-date changes, completed/archive state and option changes; old-notification/read-state continuity; Athens DST; legacy-deadline activation; template-copy defaults; UI save/reload/cancel/conflict, keyboard, desktop/narrow layouts and notification deep links. Run the normal application, HTTP and regression checks before marking the increment complete.

Operational NAS installation, measured memory, backup/restore of the new populated job records, real-device acceptance and the required publication security audit remain separate gates. No public access or infrastructure changes are authorized by this feature. See [PENDING_CHECKS.md](PENDING_CHECKS.md), [RECOVERY_CHECKS.md](RECOVERY_CHECKS.md) and [AGENTS.md](AGENTS.md).

Architecture references consulted: [Next.js instrumentation](https://nextjs.org/docs/app/guides/instrumentation) and [PostgreSQL row locking](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
