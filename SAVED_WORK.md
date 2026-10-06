# Saved boards and tasks — M2.4

In accounts mode, Home and Boards use PostgreSQL records belonging to the signed-in staff workspace. Owners and editors can create/edit boards, groups and tasks; viewers can read them. Only owners manage invitations and membership. Customer folders and private admin material are not part of this shared staff workspace.

## Current behavior

- Create/edit a board name and description; create/edit named groups and their numeric order.
- Create tasks and subtasks; save title, status, priority, date, group, parent, order and up to four active member assignees.
- My Day uses the signed-in member and their local current date. Saved tasks survive refresh and server/database restart.
- Choose Save deliberately. Browser navigation keeps unsaved task/form drafts in memory in the current tab; it does not save them to the database. Reopening a task or Resume draft restores input. Confirmed discard and sign-out clear drafts. Refresh, closing the tab and session expiry can lose unsaved input; browser unload warnings are not dependable on phones.
- Updates send the original revision. A conflicting save is rejected without overwriting either record or draft. Reloading a task asks before replacing unsaved input. Board/group conflicts retain the form: copy anything needed, cancel, refresh and reopen.
- If a save times out, its outcome is uncertain. Reconnect and inspect saved work. Each create form keeps one random creation ID, so retrying that logical creation returns its existing record rather than making a duplicate. Once committed, retrying creation does not apply subsequently edited fields; open the saved item to edit it. Updates use revision checks.
- Connection failures retain forms. Session checks continue, with a Retry connection notice; signed-out/revoked identities are redirected. No automatic offline write queue or live synchronization is claimed. Use Refresh to see another person's changes.

Docs are still explicitly labelled sample data, reset on refresh, and are not collaborative or access-controlled stored documents. Explicit prototype mode retains the original sample interface. Notes/checklists/custom fields follow in M2.5, search/filters M2.6, attachments M2.7, durable Docs M4. No saved-item deletion UI is included yet.

## Server boundary

`/api/work` authenticates the session, validates expiry and active workspace membership, and derives the workspace from the server. Mutations acquire the workspace lock shared by membership changes, then recheck the actor before writing. Viewer writes, cross-workspace IDs, unknown fields, invalid dates, invalid assignees and parent cycles are refused. Group and parent must belong to the same board. Transaction rollback protects multi-row saves. Revision checks reject stale updates.

Requests require the configured same origin and JSON, have an 8 KiB limit, and responses use no-store. The service uses the existing runtime database role; no migration or additional dependency was required. Snapshots currently return the whole small workspace; pagination and large-board performance remain future work.

Account forms use POST as their native fallback and disable submission until scripts initialize; passwords cannot fall back to URL query submission. This does not provide a JavaScript-free account workflow.

## Verification

See STATUS.md for this increment's executed checks and limits. PostgreSQL integration tests live in tests/database/work.test.mjs. HTTP smoke checks supplement, but do not replace, supported-browser role, form, navigation, failure and layout checks.
