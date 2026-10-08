# M2 database foundation

The local PostgreSQL foundation and authenticated account, work and file APIs are implemented through M2.8. Accounts-mode work persists; explicit prototype mode and Docs retain sample behavior. FOUNDATION_REVIEW.md records acceptance. NAS deployment, backup/restore and release security validation remain open; collaborative Docs persistence remains M4.

## M2 delivery order

| Increment | Observable result |
| --- | --- |
| M2.1 — Foundation | A record survives a real database restart and an additive schema update. |
| M2.2 — Accounts | Password sign-in, logout, protected routes, expiry/revocation and recovery work. |
| M2.3 — Membership | Invitations expire and cannot be reused; roles are enforced on direct requests. |
| M2.4 — Boards/tasks | Edits survive refresh/restart; concurrent edits show a conflict. |
| M2.5 — Details | Validated custom fields, notes and checklists are saved. |
| M2.6 — Finding work | Search and combined filters return only permitted tasks. |
| M2.7 — Files | Bounded uploads and authorized downloads survive restart. |
| M2.8 — Verification | Invite → sign in → board/task → assignment → attachment → search passes with real accounts. |

Each increment has a checked result and a Git checkpoint. No deployment, AI integration, email organizer or push service is included in M2. Full criteria remain in MILESTONES.md and SESSION_CHECKLIST.md.

## Selected approach

Keep Next.js/React and the existing UI. Adopt PostgreSQL 18 for the database and the pinned `pg` driver with a four-connection pool per app process. SQL migrations are explicit, ordered, checksummed and transactional. PostgreSQL constraints guard workspace/board relationships. Parameterized repository operations use revisions to detect conflicting writes. No ORM or extra always-running service is necessary for this foundation.

Select **Better Auth** for M2.2, with its PostgreSQL adapter and password/session implementation. M2.2 now installs/configures version 1.7.7; see [AUTHENTICATION.md](AUTHENTICATION.md). The following describes the original M2.1 selection boundary. Generate its authentication schema from the pinned configuration in M2.2 rather than guessing library-owned credential/session columns. `app_user.id` is the application identity; M2.2 must bind it to a verified authentication subject and test that binding. The development seed identity has no login and must never become a default account. Disable public signup; bootstrap the first owner locally. Invitation-only provisioning, recovery without an assumed email provider, session expiry/revocation and the stronger customer/admin authentication requirements must be implemented and tested before real accounts are accepted.

Primary references checked on 2026-10-06: [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql), [password authentication](https://better-auth.com/docs/authentication/email-password), [transaction handling](https://node-postgres.com/features/transactions), [embedded development PostgreSQL](https://github.com/leinelissen/embedded-postgres). These choices do not constitute a production security audit.

## Access boundary

User confirmed 2026-10-06: invited staff share the workspace according to owner/editor/viewer roles. Planned matrix: all three read shared staff boards/tasks; owner/editor edit; owner manages invitations and membership. Customer access and private admin material remain separate. A workspace owner is not automatically a portal administrator or NAS operator.

This schema contains shared staff records only. It has no customer-folder grants, admin-private documents or public sharing. Do not place private admin material into a shared staff board. Future customer/admin records need a separate explicit access model, not an extra implicit privilege on staff membership.

The narrow task repository checks membership for reads and owner/editor membership for renaming; it holds the membership row during the write and requires the expected revision. This original repository-level evidence is supplemented by verified authentication, direct HTTP authorization and the connected M2.8 access matrix. Never take `actorId` from request JSON or the sample account selector. Database credentials stay server-side.

## Data relationships

- `app_user` → `membership` → `workspace`: explicit staff membership and role.
- `workspace` → `board` → `board_group` → `task`: composite foreign keys prevent crossing workspace or board boundaries.
- `task.parent_id`: same-board subtask relationship; self-parent rejected. M2.4 validates full ancestor cycles and moves in the mutation service.
- `task_assignee`: multiple assignees, each a member of that workspace. Membership removal removes assignments.
- `column_definition` / `task_field_value`: per-board columns and task values; M2.5 validates types and protects populated definitions; see SAVED_WORK.md.
- `task.notes` / `checklist_item`: notes and ordered checklist items. The second migration adds notes without losing existing records.
- `attachment`: task ownership, uploader identity, generated UUID storage key, original name, media type, bounded byte size and pending/ready/rejected state. The initial 25 MiB ceiling is a development default; no uploads or downloads exist yet.

M2.4–M2.5 check board/group/task/column revisions in authenticated mutation services; task detail saves also check original column revisions. Group names and completion status remain independent, matching the current prototype; any workflow change needs an explicit product decision.

## Local startup

Run from `workspace-app` with Node 20.9+ and the pinned pnpm version (checks here use bundled Node 24). All database data, credentials and dependency cache are ignored under `.local/`; they are **not Git checkpoints or backups**.

```sh
pnpm install --workspace-root --frozen-lockfile
pnpm db:start
```

The development helper uses the project's pinned PostgreSQL binary. The reviewed macOS x64 package postinstall is allowed in pnpm-workspace.yaml; other operating systems require reviewing/allowing their matching package before use. This helper is development-only, not the NAS deployment plan.

`db:start` initializes only if needed, applies migrations, inserts fictional records without overwriting existing edits, and grants a separate non-superuser runtime role access to application tables. Passwords are generated randomly, stored with owner-only permissions and never printed. Temporary initialization files stay under `.local/tmp`. PostgreSQL listens only on `127.0.0.1:55432`, requires SCRAM password authentication and creates no Unix socket. It uses 32 MiB shared buffers and at most 20 connections; this is configuration, not a measured NAS memory result.

Keep that terminal open. Ctrl+C stops PostgreSQL without deleting records. Starting a second copy must fail without stopping the first. If initialization fails, inspect the reported condition; do not delete a nonempty data directory as a troubleshooting shortcut.

In another terminal, after stopping any existing app preview on 3100:

```sh
pnpm dev:db
```

This loads `.local/database.env` and `.local/auth.env` for the app server. Create the first owner using `pnpm account:setup`. Plain `pnpm dev` needs equivalent configuration; `pnpm dev:prototype` explicitly enables anonymous sample mode. `/api/health` returns `ready` only when the app can read the expected database schema; unavailable/missing schema returns 503 with no connection details, and an unconfigured accounts app returns 503; explicit prototype mode reports `prototype`. Responses are not cached. The health route never returns task/account data. **A ready database does not mean UI edits are persistent.**

Other commands:

```sh
pnpm db:status
pnpm db:migrate
pnpm db:seed
pnpm test:db
pnpm check
pnpm check:smoke
```

The database commands deliberately target only this project's development database. `db:seed` preserves edits. Add a new numbered migration rather than editing one already applied. The migration runner rejects missing/reordered/modified history, serializes concurrent runs and rolls back a failed migration batch. Runtime credentials cannot change schema or migration history. No destructive reset command is provided.

`test:db` starts its own PostgreSQL cluster on loopback ports 55433 (foundation) and 55434 (authentication), and 55435 (membership) and retains isolated fictional evidence under `.local/tests/`; it does not reset the development database. The relevant ports must be free for their respective server. The suite stops its own database processes afterward. Build/unit checks do not silently start PostgreSQL; run `test:db` explicitly for database changes.

## Remaining work and operating limits

M2.2 authentication tables, operator recovery, session cookies, protected pages and request-origin checks are implemented/tested. M2.3 adds the invitation lifecycle and role-management HTTP permission matrix; see MEMBERSHIP.md. M2.4–M2.5 provide authenticated board/task/detail saves and visible error/conflict states. M2.6 search uses the authorized snapshot. M2.7 file endpoints independently verify membership, roles and workspace scope; see FILES.md for filesystem handling and coordinated backup requirements. The runtime database role can read application tables; every future HTTP operation must use verified sessions and explicit authorization. This is not row-level-security isolation between database users.

NAS PostgreSQL packaging, restricted production network/credentials, backup/restore and measured memory are M5. Do not copy the development superuser credentials into deployment. Back up through PostgreSQL-aware tooling when that procedure is implemented; copying a live data directory or pushing source code is not a database backup. No automatic retention/deletion is configured.

## Archive schema — migration 007

`007_work_archive.sql` adds board/task archive metadata, task subtree batch provenance and board archive audit events. Records and attachment bytes are retained. Archive/restore mutations use existing workspace locks, permission checks and revisions. Applying this additive migration to the local preview preserved existing record fingerprints apart from the new fields. The complete isolated database suite includes archive/recovery/race/attachment tests; see STATUS.md for the executed result. Never edit an already-applied migration.

## M3.5 time records

Additive migration `008_time_tracking.sql` introduces `time_entry` and `time_entry_audit`, a unique running-timer constraint per user, revision-safe corrections and transaction-bound archive/access auto-stop triggers. Time mutations also lock the active user row against concurrent local operator disable. All entry access remains authenticated and workspace-scoped; write permission is owner/editor plus entry ownership. Existing boards/tasks are not converted into invented time. See [TIME_TRACKING.md](TIME_TRACKING.md).

## M3.6 template snapshots

Additive migration `009_work_templates.sql` adds `work_template` (immutable versioned JSON snapshots with reversible archive metadata) and `template_operation` (actor-bound creation fingerprints/results). Saving and applying a template use the same workspace transaction lock as saved work and membership changes, plus an active-user guard against operator disable. Copies generate independent board/group/column/task/checklist IDs. Failed field mapping, limits or activity writes roll back the entire copy. Repeated unchanged requests return the recorded result; changed requests cannot reuse a committed creation ID.

Copy rules and limits are in [SAVED_WORK.md](SAVED_WORK.md). Template tables and operation identities belong in the database backup; preserving them also preserves safe retries after restart/recovery. This increment adds no service, dependency or scheduled worker.

## M4.1 dependency edges

Additive migration `010_task_dependencies.sql` adds workspace-scoped `task_dependency` edges with composite task foreign keys, a self-link check and reverse lookup index. Work writes hold the workspace lock; bounded edge replacement, recursive cycle validation, task revisions, details and activity commit together. Writes also hold an active-user row lock against concurrent operator disable. Prerequisites are advisory and never mutate dependent completion status. Archive preserves edges.

Snapshots include prerequisite IDs for active and archived tasks. Templates capture only edges whose endpoints are included, insert all copied tasks before remapping links and accept older snapshots without this field. Include `task_dependency` in database recovery procedures. This adds no background service, package or scheduled worker; M4.2 remains separate.
