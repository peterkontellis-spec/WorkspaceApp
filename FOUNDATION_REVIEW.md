# Persistent foundation acceptance — M2.8

Accepted locally on 2026-10-06. M2.1–M2.8 now provide real accounts, invitations, staff roles, saved boards/groups/tasks/subtasks, custom fields, multiple assignees, notes/checklists, search/filters and task attachments. This closes Stage 2; it is not publication or NAS readiness.

## Permission matrix

| Operation | Owner | Editor | Viewer | Other workspace / signed out |
| --- | --- | --- | --- | --- |
| Read shared tasks and search results | Yes | Yes | Yes | No access to this workspace |
| Create/edit shared boards and task details | Yes | Yes | No | No |
| List/download shared task files | Yes | Yes | Yes | No |
| Upload task attachments | Yes | Yes | No | No |
| Read staff roster | Yes | Yes | Yes | No access to this workspace |
| Invite, change roles, remove members | Yes | No | No | No |

Fresh server checks enforce these rules; a hidden button is not the permission boundary. Role changes revoke existing sessions; removal also clears assignments while preserving work and attachments. Private admin/customer material is not implemented or part of this shared staff workspace.

## Evidence

- Full sequential PostgreSQL suite: **58/58 passed**, no skipped tests. Includes actual database restart, migrations, authentication/recovery, invitation expiry/reuse/capacity, direct-request permissions, concurrent changes/conflicts, rollback, attachment limits/interruption/storage and uncertain-commit handling.
- New `tests/database/foundation-journey.test.mjs`: real invitation creation/acceptance/sign-in, board/task assignment, notes/custom field/checklist, upload, combined search, restart and owner/editor/viewer/outsider boundaries across Work, Files and Team; demotion/removal revokes old access and preserves records.
- `pnpm check`: TypeScript, **29/29 behavioral tests**, warning-free production build. HTTP smoke **20/20 passed** against the unchanged running app snapshot.
- Supported browser: owner created an editor invitation; an existing fictional account accepted with its current password, signed in, created a board/task, assigned itself, saved searchable notes and uploaded a synthetic Unicode text file. Go to found it by notes; reopening and refresh retained assignment, notes and attachment. Editor Team access showed no administration controls. New-account creation/recovery already has user-assisted browser evidence in STATUS.md and current automated coverage; this run did not re-enter a new password in the browser.
- Default desktop plus 1440×900 and 360×800 inspection covered the connected task/attachment journey, keyboard focus, search return and read-only team screen. Scoped Impeccable/Web Interface Guidelines/React source review found no new blocking defect; detector returned `[]`, and captured console warnings/errors were empty. Existing visual design was preserved. No new physical-phone, software-keyboard or 200% zoom claim.

The test-only cleanup helper initially referenced an incorrect invitation column, stopped inside its transaction and rolled back. Correcting it to the schema's `created_by` allowed guarded cleanup. Three QA identities, one workspace/board/task, its invitation and one synthetic attachment were removed. Preview Owner, BOARDTEST's two tasks and both other preview boards/tasks were preserved. User login restored and viewport reset.

## Remaining boundaries

Docs remain explicitly sample-only until M4. Table/Kanban/Calendar, live collaboration, activity/notifications, timers and templates belong to M3. Saves use explicit actions and revision checks; drafts are tab memory, shared refresh is manual, and there is no offline queue. Whole-workspace snapshots and Files lists are intended for the initial small team; large datasets are unmeasured.

Attachments have the formats/25 MiB boundary documented in FILES.md, no malware-scanning claim, no deletion UI or inline previews, and possible orphan bytes after crashes/uncertain commits. Coordinated backup/restore and cleanup tooling remain rollout work. NAS memory/performance, HTTPS/network setup and the required Cloudflare pre-publication audit remain open. No publication, spending or infrastructure changes were made.

Next: a bounded UI usability pass based on the user's observations, then M3.1 Table/Kanban/Calendar. Do not redesign the established interface or begin M3 automatically while the UI review is being discussed.
