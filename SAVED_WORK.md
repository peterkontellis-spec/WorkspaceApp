# Saved workspace work

In accounts mode, Home and Boards use PostgreSQL records belonging to the signed-in staff workspace. Owners and editors can create/edit boards, groups and tasks; viewers can read them. Only owners manage invitations and membership. Customer folders and private admin material are not part of this shared staff workspace.

## Time tracking

Accounts-mode Time provides shared completed entries, own timers/manual corrections, reversible void/restore and task/board/date totals. Owners/editors edit only their own time; viewers remain read-only. See [TIME_TRACKING.md](TIME_TRACKING.md) for permissions, stored timestamp semantics, date ranges and recovery.

## Task dependencies — M4.1

Saved tasks can have up to 50 distinct prerequisites from active tasks anywhere in the shared workspace. Owners/editors add or remove links in the task panel, then Save task; viewers can read links and the reverse Needed by list. Search matches task or board names and shows up to 100 choices at once. Removing an existing link offers Undo until saving. Dependency changes share the task revision and transaction with other edits, preserving drafts and rejecting stale saves.

Prerequisites are advisory: unresolved links show warnings in task details and Table/Kanban/Calendar, but never prevent completion or automatically reopen a dependent task. A prerequisite is resolved only when Done and unarchived. Archive preserves links; restore the prerequisite or remove its link to clear an archived warning. Existing archived links can remain during unrelated edits; adding an archived task requires restoration first. Self-links, duplicate links, cross-workspace links and circular chains are rejected on the server, including competing updates. Changes appear in task activity and use existing assignee notifications.

## Reusable templates — M3.6

Templates is available in navigation/search and from Boards. A saved task exposes Save task as template when its editor has no unsaved changes. Owners/editors can save and use shared task/board templates; viewers can browse. Owners/editors archive or restore task templates; only owners archive or restore board templates. Archive preserves the immutable snapshot and does not change existing copies. Permanent template deletion and template editing are not implemented; save a new template for a revised process.

A template captures current saved source work atomically, with a revision check on the selected board or root task. A board revision does not represent every child revision: the form explicitly captures the latest saved descendants at submission. Unsaved editor input is excluded. Each application creates independent record IDs and fresh creation activity; the source, saved snapshot and other copies stay independent.

| Data | Copy rule |
| --- | --- |
| Board | Name chosen when applying; description, groups and column definitions retained. Archived tasks excluded. |
| Task | Saved title, plain-text notes, priority, active subtree and checklist labels retained. |
| Progress | Status resets to To do; checklist items reset to unchecked. |
| Prerequisites | Links are retained only when both tasks are included in the captured snapshot, then remapped to new tasks. External links are omitted; older immutable templates do not acquire new links. |
| Dates and people | Due dates and assignments cleared. |
| Custom fields | Text/number values retained. Date/status/link values cleared; column settings retained. |
| Files, time, history | Attachments, time entries and previous activity excluded. Only fresh creation activity is written. |
| Documents | No document copy/connection. Links embedded in plain-text notes remain text; custom link fields are cleared. |

Task templates capture definitions used by the subtree. On another board, identical name/type/settings reuse a matching column one-to-one; missing definitions are added. Incompatible same-name columns or exceeding 20 columns rejects the entire operation without partial work. Board templates preserve all column definitions, including duplicate names. Limits: 200 task records, 100 groups, 20 columns, 2 MiB of snapshot content.

The library refreshes while visible/online using the existing polling coordinator. Draft names/destinations stay in this tab across in-app navigation. A lost response retains the same creation ID; retrying the unchanged request returns the original result without another copy. Changed-payload retries reject. After a revision conflict, Use latest saved version explicitly reloads the authorized source/template revision while keeping the entered name/destination; it does not silently replace a draft. Session loss clears protected work. Reload/closing the tab can lose unsaved input; there is no offline queue or durable draft promise.

## Filtering and navigation

Search stays in the board toolbar. Filters opens a popup with Status, Assignee, Priority and Due date. Apply filters submits the current search and selected filters together; Cancel, Escape, the close button or clicking outside dismisses unsubmitted filter changes. Inline Search uses the already-applied filters. URL state, selected board view/month, result summaries and Clear filters remain available.

The breadcrumb trail is navigation: Workspace opens Home; the section label opens its main page, including Boards from a task board and Docs from a document route. Desktop and narrow layouts use real links with keyboard focus and touch targets; phone headers show the trail on its own row.

## Current behavior

- Create/edit a board name and description; create/edit named groups and their numeric order.
- Create tasks and subtasks; save title, status, priority, date, group, parent, order and up to four active member assignees.
- Add board-specific text, status, number/cost, date and link columns. Values appear below each task and are edited in its details panel. Owners/editors can manage columns; viewers can read values.
- Save plain-text notes and checklist labels/completion alongside task details. Removing a checklist item remains a draft change with Undo until Save.
- My Day uses the signed-in member and their local current date. Saved tasks survive refresh and server/database restart.
- Task details and board/group forms use an explicit Save. Table status, assignees, date and priority, and Kanban status save immediately with visible pending/error feedback. Browser navigation keeps unsaved task/form drafts in memory in the current tab; it does not save them to the database. Reopening a task or Resume draft restores input. Confirmed discard and sign-out clear drafts. Refresh, closing the tab and session expiry can lose unsaved input; browser unload warnings are not dependable on phones.
- Updates send the original revision. A conflicting save is rejected without overwriting either record or draft. Reloading a task asks before replacing unsaved input. Board/group conflicts retain the form: copy anything needed, cancel, refresh and reopen.
- If a save times out, its outcome is uncertain. Reconnect and inspect saved work. Each create form keeps one random creation ID, so retrying that logical creation returns its existing record rather than making a duplicate. Once committed, retrying creation does not apply subsequently edited fields; open the saved item to edit it. Updates use revision checks.
- Connection failures retain forms. Session checks continue, with a Retry connection notice; signed-out/revoked identities are redirected. There is no offline write queue. Visible online tabs refresh through M3.2 polling; manual Refresh remains available.

Accounts-mode Docs is a non-editable storage-pending placeholder until NAS configuration is settled. Explicit prototype mode retains its sample editor. Durable Docs remain M4. Task attachments and the Files library are implemented; see [FILES.md](FILES.md).

## Home and Overview — M3.4

Home shows the signed-in person's open/in-progress/overdue/due-today/done counts, My Day buckets, private unread notification count/link, and the five most recently updated assigned tasks. Recent tasks use saved task timestamps, not browser visit history; completed tasks can appear there. Personal filtering does not make shared tasks private.

Overview is available to all current staff roles from desktop navigation, the mobile navigation menu, or Home's Team overview link. It shows board completion, open overdue tasks and workload with links back to the saved records. Viewers retain read-only access. It uses the existing authorized snapshot and polling; no extra service, polling stream, database migration or scoring system is added. The star remains an illustrative appearance preview.

Counting rules: each task/subtask is one record with equal weight; completed means current status Done, with no reporting-period claim. Board completion is rounded Done / total; an empty board says No tasks yet. Archived tasks/boards are excluded. Due buckets exclude Done. Dates follow the viewer's device timezone and refresh at local midnight and after focus/visibility changes. Workload is open assignments, not hours/capacity. Shared assignments count for every assignee but only once in team totals. Unassigned means no assignee IDs. Tasks assigned solely to unavailable members have a separate No active assignee row and recovery list; mixed active/inactive assignments remain with the active members. The picker names inactive assignments and offers explicit removal so owners/editors can reassign safely.

Offline dashboards retain the last received data with an explicit connection notice. Existing account-expiry/revocation behavior still clears protected data. Actual checks and device limitations are in STATUS.md and PENDING_CHECKS.md.

## Archive and quick edits — corrective blocks

Owners and editors can archive/restore tasks; only owners can archive/restore boards. Viewers remain read-only. Archive asks for confirmation, keeps a recoverable record and offers Undo plus permanent Archived tasks/Archived boards navigation. Active Home, search, views and the general Files library exclude archived work. Historical task links remain readable with attachments and activity.

Archiving a task also archives its currently active descendants as one batch. Restoring it revives only that batch; earlier independent archives remain archived. Restore a parent before its child. Archiving a board freezes its work; restoring the board does not revive independently archived tasks. Board transitions invalidate old task/group/column revisions, including drafts opened before an archive/restore cycle. A remotely archived dirty task retains its draft for copying/review and cannot silently overwrite restored work. No permanent deletion or purge exists.

Quick edits serialize writes and disable competing controls while saving. Failed selections remain in this tab across view navigation and offer Retry/Discard; retry retains the original revision and rejects conflicts. Finish an existing task-details draft before using quick edits. These drafts are not durable offline storage. Dates show Today or a readable calendar date, with explicit Overdue text for unfinished past-due work.

The task panel keeps Save/Cancel outside its scrollable content. Main fields precede notes/checklist; group, parent, order and custom values sit in More task settings. Physical software-keyboard behavior requires its own phone check.

## Finding saved work

Use board Search tasks for that board, or Boards → Find tasks for the whole staff workspace. Go to / Cmd+K also finds tasks and links to all matches; it shows at most eight task matches in the dialog. Task search is literal, case-insensitive title/notes text, up to 200 characters. Checklist text, custom values, attachments and document contents are not searched.

Combine status, assignee (including Unassigned), priority and due date with AND. Before today / Today / After today use your local calendar date; No date means an empty due date. Date filters include any completion state unless Status is also set. Use Search or Apply filters to apply edited inputs. Clear filters resets them.

Applied filters are URL parameters, restored on refresh and Back/Forward. Opening/closing a task keeps the result context. If an edit makes it stop matching, it leaves the result list and focus returns to the page. No-results copy distinguishes filtering from deleted data. Search works on the existing server-authorized workspace snapshot and updates after Save or Refresh; ordinary polling also refreshes results without introducing a separate search service.

## Column changes and limits

Each board supports up to 20 columns. Text values allow 1,000 characters; status columns have 1–20 distinct options; numbers must be finite and within ±1 trillion; dates must be real calendar dates. Cost columns use EUR, USD or GBP with at most two decimal places, without conversion. Links allow up to 2,048 characters and must be absolute HTTP(S) addresses without credentials or control characters. Clearing a value removes it.

Rename/reorder preserves values. A populated column cannot change type, number format or currency. Status options used by tasks cannot be removed/renamed; adding options or removing unused ones is allowed. Clear/change existing values before changing the definition. There is no automatic conversion or delete-column action.

Notes allow 50,000 characters and retain line breaks as plain text. A checklist supports 50 items, each with a label up to 500 characters. Task fields, notes, checklist and assignments save in one transaction. Both task and column revisions are checked, including after draft restoration; stale changes are rejected. Checklist identities cannot move across tasks or workspaces.

## Server boundary

`/api/work` authenticates the session, validates expiry and active workspace membership, and derives the workspace from the server. Mutations acquire the workspace lock shared by membership changes, then recheck the actor before writing. Viewer writes, cross-workspace IDs, unknown fields, invalid dates, invalid assignees and parent cycles are refused. Group and parent must belong to the same board. Transaction rollback protects multi-row saves. Revision checks reject stale updates.

Requests require the configured same origin and JSON, have a 512 KiB limit for bounded notes/checklist/field payloads, and responses use no-store. The service uses the existing runtime database role; no migration or additional dependency was required. Snapshots currently return the whole small workspace; pagination and large-board performance remain future work.

Account forms use POST as their native fallback and disable submission until scripts initialize; passwords cannot fall back to URL query submission. This does not provide a JavaScript-free account workflow.

## Verification

See STATUS.md for this increment's executed checks and limits. PostgreSQL integration tests live in tests/database/work.test.mjs. HTTP smoke checks supplement, but do not replace, supported-browser role, form, navigation, failure and layout checks.
