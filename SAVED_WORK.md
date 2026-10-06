# Saved boards and task details — M2.4–M2.6

In accounts mode, Home and Boards use PostgreSQL records belonging to the signed-in staff workspace. Owners and editors can create/edit boards, groups and tasks; viewers can read them. Only owners manage invitations and membership. Customer folders and private admin material are not part of this shared staff workspace.

## Current behavior

- Create/edit a board name and description; create/edit named groups and their numeric order.
- Create tasks and subtasks; save title, status, priority, date, group, parent, order and up to four active member assignees.
- Add board-specific text, status, number/cost, date and link columns. Values appear below each task and are edited in its details panel. Owners/editors can manage columns; viewers can read values.
- Save plain-text notes and checklist labels/completion alongside task details. Removing a checklist item remains a draft change with Undo until Save.
- My Day uses the signed-in member and their local current date. Saved tasks survive refresh and server/database restart.
- Choose Save deliberately. Browser navigation keeps unsaved task/form drafts in memory in the current tab; it does not save them to the database. Reopening a task or Resume draft restores input. Confirmed discard and sign-out clear drafts. Refresh, closing the tab and session expiry can lose unsaved input; browser unload warnings are not dependable on phones.
- Updates send the original revision. A conflicting save is rejected without overwriting either record or draft. Reloading a task asks before replacing unsaved input. Board/group conflicts retain the form: copy anything needed, cancel, refresh and reopen.
- If a save times out, its outcome is uncertain. Reconnect and inspect saved work. Each create form keeps one random creation ID, so retrying that logical creation returns its existing record rather than making a duplicate. Once committed, retrying creation does not apply subsequently edited fields; open the saved item to edit it. Updates use revision checks.
- Connection failures retain forms. Session checks continue, with a Retry connection notice; signed-out/revoked identities are redirected. No automatic offline write queue or live synchronization is claimed. Use Refresh to see another person's changes.

Docs are still explicitly labelled sample data, reset on refresh, and are not collaborative or access-controlled stored documents. Explicit prototype mode retains the original sample interface. Notes/checklists/custom fields and task search/filters are implemented. Attachments follow in M2.7, durable Docs M4. No saved-item deletion UI is included yet.

## Finding saved work

Use board Search tasks for that board, or Boards → Find tasks for the whole staff workspace. Go to / Cmd+K also finds tasks and links to all matches; it shows at most eight task matches in the dialog. Task search is literal, case-insensitive title/notes text, up to 200 characters. Checklist text, custom values, attachments and document contents are not searched.

Combine status, assignee (including Unassigned), priority and due date with AND. Before today / Today / After today use your local calendar date; No date means an empty due date. Date filters include any completion state unless Status is also set. Use Search or Apply filters to apply edited inputs. Clear filters resets them.

Applied filters are URL parameters, restored on refresh and Back/Forward. Opening/closing a task keeps the result context. If an edit makes it stop matching, it leaves the result list and focus returns to the page. No-results copy distinguishes filtering from deleted data. Search works on the existing server-authorized workspace snapshot and updates after Save or Refresh; it does not introduce automatic live synchronization or a separate search service.

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
