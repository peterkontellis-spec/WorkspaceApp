# Current status

## Paused; pre-publication audit required — 2026-10-06

User paused development after M2.4. Resume at M2.5 only on their continuation. Installed Cloudflare's official `security-audit` skill at `/Users/peterkontellis/.codex/skills/security-audit/SKILL.md` from https://github.com/cloudflare/security-audit-skill using the skill-installer helper; installation and required workflow/reporting files verified. It is available on the next turn. No security audit was executed in this setup task and no publication/deployment occurred.

AGENTS.md and the M5 release checklist now require this audit before any publication/external release, with release-candidate/configuration evidence, fixes/retests and revalidation after changes. Output stays in an explicitly selected ignored project audit directory; usage/no-spend limits still apply. Documentation checks passed; application tests were not rerun for this instruction-only change. Development remains paused.

## M2.4 accepted — saved boards/tasks and role enforcement — 2026-10-06

Accounts-mode Home and Boards now use the real staff workspace. Owners/editors can create/edit boards, groups, tasks, numeric ordering, status, priority, dates, multiple real assignees and subtasks. Viewers get read-only boards/task details; the server independently rejects their writes. Team administration remains owner-only. Docs remain explicitly sample-only. See [SAVED_WORK.md](SAVED_WORK.md) for behavior and limits.

Validation:
- Final `pnpm check`: TypeScript, **23/23 behavioral tests** and production build passed. `pnpm check:smoke`: **19/19 passed**, including safe pre-script account-form HTML, authenticated work API, signed-out denial, accurate saved/sample disclosures and obsolete sample-board rejection.
- Full PostgreSQL suite passed **38/38** before the retry hardening. Final affected work suite passed **10/10**, adding retry/collision/concurrent-create tests to the original eight. Together with unchanged foundation/auth/membership suites, **40 test groups covered**. Temporary test clusters stopped.
- Work tests verify owner/editor writes, viewer denial, session revocation/demotion, cross-workspace IDs, invalid dates/assignees/parent cycles, stale board/group/task revisions, transaction rollback, restart persistence and parallel workers. No client-supplied role/workspace is trusted. Retried creates use one stable UUID and cannot insert duplicates.
- Supported browser: desktop/default and 1440×900; narrow 360×800. Created/edited a board, created/renamed/reordered groups, created/edited/reordered tasks and a subtask, changed status/priority/group, selected two members from the dropdown, selected October 7 using calendar arrow/Enter keys, and confirmed saved values after refresh and application restart. My Day uses the real assigned member. Viewer login showed the same saved work with no add/edit/save controls and read-only task facts.
- Unsaved task text survived Back/Forward; metadata input survived command-menu navigation and Resume draft. Escape/outside clicks prompted for dirty input; Keep editing retained it. A separate authenticated request changed a revision; the browser save was rejected while retaining its draft, and confirmed reload retrieved the newer value.
- Controlled loopback-server pauses exposed and fixed an inaccessible connection screen behind a native modal, raw timeout copy, and ambiguous create retries. Final pause retained editable input; resumed/retried creation produced exactly one board; Retry connection cleared the notice without a page reload. No background save queue is claimed.
- Found unsafe native GET fallback while a rebuilt preview had stale scripts: fictional QA login fields reached the local address bar. Account/invitation forms now use POST and disable submission until initialization. Final login and HTML fallback checks passed. No real credentials were used in these tests.
- Scoped Impeccable, current Web Interface Guidelines and React review applied. Detector returned `[]`; final captured browser warnings/errors were empty. Narrow dialog fit the viewport (297px wide; document 345px within 360px). Calendar, form, assignee and action controls remained reachable; desktop hierarchy retained the existing dark design. No new physical-phone, software-keyboard or 200% zoom evidence is claimed.

Cleanup precisely removed the two recorded QA identities, two QA boards and two QA tasks, preserving seed records and unrelated local security/critique drafts. There were no real accounts before QA setup; first-owner setup is available again. Preview is running at loopback3100, PID **55985**; database supervisor **51561** at loopback55432. Verify process identities before acting. Preview tab is at sign-in; temporary viewport reset. No NAS/public deployment, purchases, credits or resets. Latest weekly allowance **60% used / 40% remaining**.

Limits: drafts are tab memory, not durable saved work; phone unload warnings remain unreliable. Shared work refresh is manual, whole-workspace snapshots are sized for this small initial workspace, and numeric ordering is the initial implementation. Saved-item deletion, custom fields, notes/checklists, attachments and durable Docs are not delivered here. Next: **M2.5 custom columns and saved task notes/checklists**, in a separate bounded increment. Earlier sections below are historical.

## M2.3 acceptance complete — 2026-10-06

The user confirmed invitee signup/login works. Supported browser inspection confirmed the real viewer sees a read-only roster, no invitation/role/removal controls, and a clear instruction to ask an owner. Owner UI changed the disposable viewer to editor with confirmation and immediately showed the saved role. Removing the last owner was rejected with a focused error; removing the other member succeeded. Captured warnings/errors were empty. Combined with prior desktop/narrow and automated evidence below, M2.3 is accepted for staff membership.

The user observed sample board/Docs editing looks unrestricted. This is the disclosed sample-only behavior, not a membership-management bypass. M2.4 will replace account-mode Home/Boards with database-backed work and enforce viewer read-only controls and server writes. Docs remain sample-only until M4; private admin/customer access remains separate.

Disposed of exactly the recorded QA owner/invitee identities, invitation records and empty workspace using validation guards. Preserved seed records and unrelated drafts. No real accounts existed before those tests; first-owner setup is again available. No app code changed to close M2.3, so prior build/30 database groups/23 unit tests/19 HTTP evidence was retained rather than redundantly rerun. Preview still loopback3100, no spend/reset/deployment. Next: **M2.4 durable boards/groups/tasks**, now authorized by the user's continuation.

## M2.3 — Implemented; final invitation browser check pending — 2026-10-06

Implemented owner-issued email-bound invitation links, saved team roster, owner/editor/viewer membership controls, cancellation, role changes and removal. Links are hashed, valid for 24 hours, one-use, and reserve a place in a maximum four-person team. Owner mutations recheck live identity and workspace membership under a database lock. Last-owner demotion/removal is blocked. Role changes/removal revoke sessions; removal preserves identity/work and clears assignments. Demoting/removing an owner cancels their unused invitations, and acceptance rejects operator-disabled issuers. Removed people can rejoin with their existing password. Verified operator recovery supports an active unassigned identity only with a valid invitation from an active owner; recovery never restores membership. See [MEMBERSHIP.md](MEMBERSHIP.md).

Actual checks:
- `pnpm check`: TypeScript, **23/23 behavioral tests** and production build passed after fixing Next's route-config re-export constraint. Final UI state fixes passed a further production build/typecheck. Operator-only recovery changes do not affect the browser bundle.
- PostgreSQL: initial full `pnpm test:db` **27/27 passed**. Subsequent disabled-issuer and reinvited-recovery changes passed all **19/19 final auth+membership groups** (8 auth, 11 membership), alongside the unchanged 11 passing foundation groups: **30 test groups covered**. Isolated ports 55433–55435 stopped after tests.
- Direct request tests reject forged/signed-out callers, editor/viewer membership writes, cross-workspace targets, invalid JSON/origins/roles, expired/cancelled/reused invites and disabled accounts. Six simultaneous acceptances create one member; separate-pool capacity races admit only the available place. Invitations survive a database restart. Failed signup/membership work compensates the new identity; existing data survives removal. Persistent throttling and operator-recovery eligibility/one-use reset were verified.
- `pnpm check:smoke`: **19/19 passed** on the production accounts preview, including team protection and invalid invitation rejection.
- Supported browser: desktop 1440×900 and narrow 360×800. Entered Team access from sidebar; inspected saved roster, role explanations, empty invitations, real-versus-sample disclosures. Remove confirmation opens and Escape restores trigger focus. Created a disposable viewer invitation, copied its link, cancelled it via the narrow dialog and verified the old link displays a focused refusal. Recreated the invitation; inspected narrow join form and populated fictional name. Measured team controls at 48–49px and document scroll width 345px in a 360px viewport. Viewport reset before user handoff. No new physical-phone/zoom evidence claimed.
- Scoped Impeccable/context/craft-floor, current Web Interface Guidelines and React review applied; detector returned `[]`. Independent review found and fixed stale invitation state on token changes, stale roster after successful mutations, and reinvited-account recovery. Main review found and fixed pool starvation from lock waiters; mutation queue is bounded and database locking remains authoritative. No broad accessibility/security certification is claimed.

Remaining acceptance: browser policy requires the user to enter/submit a new password. The disposable invitation page is open for **m23-invitee@example.test** with name “Invitation QA Viewer”; user was asked to join with a fictional password, sign in, then confirm Team access. Do not enter a password for them or claim this passed. After their answer, inspect viewer's read-only team screen; finish role-change/removal UI confirmation and last-owner error checks, check console output, then precisely remove the disposable QA identities/invitations and close the increment. No task persistence work should obscure this pending gate.

Runtime: preview PID **54013** at 127.0.0.1:3100, local database supervisor PID **51561** at 127.0.0.1:55432; verify live process identity before acting. Migration 005 applied. No real accounts existed before the disposable owner was created. Temporary QA IDs and smoke credentials are recorded in ignored owner-only `.local/m23-qa.json` / `.local/m23-smoke.json`; `.local/cleanup-m23-qa.mjs` validates exact identities and empty workspace before cleanup. Do not run cleanup before the pending check. First real owner setup becomes available after cleanup. Browser tab 7 is a user handoff; don't interrupt password entry. Hotspot remains closed, no deployment/spend/credits/reset. Latest weekly allowance: **52% used / 48% remaining**. Unrelated local security/critique drafts are preserved and excluded from this checkpoint.

Next action: finish the user-assisted invitation journey and remaining membership UI checks, clean up QA, and sign off M2.3. Then proceed to M2.4 persistent boards/tasks in a new bounded increment. Accounts and team membership are real; board/task/Docs edits remain temporary samples.

Earlier sections below are historical and do not override this M2.3 status.

## M2.2 — Accounts and sessions complete — 2026-10-06

Delivered password sign-in/sign-out, protected workspace routes, first-owner setup, database-backed sessions, membership-bound identity, and local-operator recovery. The user explicitly selected identity verification by the operator followed by a short-lived reset link. Better Auth 1.7.7 is installed; generated/reviewed migration 003 and additive binding migration 004 are applied. Public signup and recovery issuance are closed. See [AUTHENTICATION.md](AUTHENTICATION.md) for setup, controls and operating limits.

Actual checks:
- `pnpm check`: TypeScript, **23/23 behavioral tests**, production build passed, including the final readiness change.
- `pnpm test:db`: **19/19 real PostgreSQL integration tests passed** (8 authentication groups plus 11 foundation tests). Checked first-owner setup and rollback compensation, bound identities, invalid credentials, forged/expired/revoked sessions, database restart, removed membership, disabled accounts, cookie attributes, origin/body limits, persistent throttling, expired/reused reset links, concurrent reset attempts and password/session replacement. Isolated test clusters stopped.
- `pnpm check:smoke` with a disposable authenticated account: **17/17 passed**, including direct signed-out rejection. The later health-only change passed the full build/check plus a direct readiness/no-store and signed-out redirect confirmation on the refreshed preview.
- Supported browser: desktop 1440×900, narrow 360×800 and reset form 320×568. Invalid login shows a focused generic error; keyboard reaches password visibility; login/refresh preserve real identity; changing fictional members does not change it. Account dialog and sign-out remain reachable on narrow screens. Editing Docs then signing out clears sample drafts without a before-unload prompt; Back does not restore them. Recovery guidance, missing-token state and actual reset form were inspected; no horizontal overflow and 44–48px controls. Captured warnings/errors were empty. The user submitted the disposable reset themselves and confirmed “Password updated”; subsequent browser observation showed that QA account signed in at Home. No new physical-phone or actual zoom test is claimed.
- Scoped Impeccable, current Web Interface Guidelines and React review completed; detector returned no findings. Independent read-only review caught passive polls extending idle expiry, incomplete setup leaving an identity, and unbounded fetches. All three were fixed; passive-versus-active session behavior and forced setup failure have regression coverage.
- Initial stale generated Next route types and test-fixture session/throttle interference were corrected; final results above passed. Browser credential-change policy was respected through user handoff, not bypassed.

Runtime: refreshed Mac-only production preview PID 53042 on 127.0.0.1:3100; database supervisor PID 51561 on 127.0.0.1:55432. Verify PIDs before acting. Disposable QA identity, its empty workspace, test credential file and reset-link file were removed precisely; fictional seed data remains. First-owner setup is available to the user. All local records/secrets stay ignored under `.local/`; Git is not their backup. Hotspot remains closed. No NAS/public deployment, purchases, credits or resets. Latest account-wide weekly snapshot: **48% used / 52% remaining**.

Limits: real authentication protects a sample-data UI; board/task/Doc edits are still temporary. Invitations and full role administration are M2.3, durable boards/tasks M2.4, collaborative Docs M4. Loopback throttling uses a shared client bucket; proxy configuration, HTTPS production hardening, backup/restore and private admin/customer access are not signed off. Unrelated security/critique drafts remain preserved and excluded from this checkpoint.

Next action: **M2.3 — invitations and roles**. Implement owner-issued expiring, one-use invitation links, server-enforced owner/editor/viewer membership actions, and direct-request/revocation tests; preserve separate customer/admin boundaries. The user can create their own local owner now using `pnpm account:setup` (AUTHENTICATION.md).

Earlier sections below are historical and do not override this M2.2 status.

## M2.1 — Application and data foundation complete — 2026-10-06

User authorized M2 and confirmed shared staff boards/tasks according to owner/editor/viewer roles; customer access and private admin material remain separate. M2 is being delivered in the eight existing increments, outlined in [DATABASE.md](DATABASE.md). M2.1 is complete; M2.2–M2.8 and Stage 2 remain open.

Delivered: pinned PostgreSQL 18.4 development binary and pg driver; project-local loopback-only database with random owner-only credentials; non-superuser app role; users/membership/board/group/task/assignee/custom-field/checklist/attachment schema; ordered checksummed transactional migrations; non-destructive fictional seed; narrow membership-checked task read/rename repository with revision conflicts; server-only connection and no-store readiness endpoint. Better Auth is selected for M2.2, not installed or functioning yet. No task-write HTTP endpoint exists. Existing UI remains sample-only and retains its M1 disclosure; Docs persistence remains M4.

Actual checks:
- `pnpm check`: TypeScript, existing **23 tests**, production build passed. No React/UI behavior changed in this increment.
- `pnpm test:db`: **11/11 real PostgreSQL integration tests passed**. A task with a changed title/revision survived additive migration 002 and a real stop/start with a different PostgreSQL PID. Seed reruns preserved edits. Concurrent renames produced one save/one conflict; viewer writes, unknown/revoked reads, cross-workspace links, nonmember assignments, invalid task fields, schema changes by the runtime role and bad database passwords were rejected. Failed transactions and migrations rolled back; checksum drift failed closed; concurrent migration runs serialized.
- Reviewed startup failure found and fixed: the embedded helper could wait on an already-exited child and normalize a failed start to exit 0. The regression subprocess now exits 1 promptly on duplicate startup and the original database remains alive.
- First sandboxed database run failed at OS shared-memory permission, before application assertions. Re-ran through approved execution with PostgreSQL's needed permissions; final results above are the real checks. No security restriction was bypassed.
- pnpm workspace/store mismatch initially prevented checks. Reconciled installation into the ignored project-local cache; clean isolated offline installation using `pnpm install --workspace-root --frozen-lockfile` succeeded. The only allowed dependency build script is the inspected macOS x64 PostgreSQL symlink hydration.
- Production `/api/health`: unconfigured reports prototype; configured reports ready; stopping the actual development database returns sanitized **503 unavailable**, then restarting it recovers ready without restarting the app. All responses checked no-store. `pnpm check:smoke`: **16/16 passed**. `db:status`: two migrations and one fictional task.
- Independent read-only foundation review completed and its startup finding fixed/tested. Impeccable/Web Design Guidelines/React UI review and fresh desktop/phone interaction checks are not applicable to this backend-only increment; no new UI or physical-device acceptance is claimed. Existing M1 browser evidence remains historical.

Runtime: Mac-only production preview PID 51513 on 127.0.0.1:3100; local database supervisor PID 51561 on 127.0.0.1:55432 (verify live PIDs before any action). Integration clusters stopped; hotspot remains closed. All database records/credentials are ignored under `.local/`, not Git backups. No NAS/public deployment, credits or resets. Latest account-wide weekly snapshot: **43% used / 57% remaining**.

Limits: repository membership checks are not HTTP/session authentication; custom-field validation, subtask cycle/move rules and full mutation permission checks belong to subsequent M2 increments. No login, durable UI edits, uploads or customer portal is enabled. NAS memory, backup/restore and production hardening are not signed off. Unrelated local security/critique drafts are preserved and excluded from this checkpoint.

Next action: **M2.2** — configure the selected authentication library with a generated reviewed schema, local first-owner setup, invitation-only account provisioning, protected routes, secure sessions and a defined recovery method without assuming an email provider. Test direct signed-out requests, expiry/logout/revocation and recovery before connecting real UI data.

Earlier sections below are historical and do not override this M2.1 status.

## M1 interaction follow-up — 2026-10-06

Implemented the user's post-sign-off interaction requests:
- Shared assignee dropdown for board rows and task details. A native HTML popover floats above content, supports multiple checkbox selections and keeps the row height unchanged; Done, outside click and Escape dismiss it. The trigger announces current assignees. Scroll/resize listeners exist only while open and are cleaned up; no runtime dependency added.
- Add task fills the available action row (48px high). Task title links fill their title area (at least 44px high); assignee labels are full-row checkbox targets. No parent click handler swallows adjacent controls.
- Clicking outside a task panel closes it through the existing navigation/focus path and preserves session edits/drafts. A 24px outside gutter remains on phones. Shared dialogs use the same pointer-start/end guard: inside padding and dragging from inside to outside do not dismiss. Close buttons and Escape remain available.
- Narrow task date/group fields use full width after the new gutter exposed cramped date wrapping at 360px.

Actual checks: `pnpm check` passed TypeScript, all **23 behavioural tests** and production build; the final CSS changes passed production build/type checking. `pnpm check:smoke` passed **16/16** routes before the final CSS-only date-width adjustment; that adjustment was directly inspected in the refreshed production browser. Impeccable context/adapt/craft-floor and current Web Interface Guidelines were applied, React listener patterns reviewed, and the scoped detector returned `[]`. No broad accessibility certification is claimed.

Supported in-app browser evidence (desktop 1440×900 and default desktop; emulated 390×844 and 360×800):
- Desktop board row remained **113px** high with its assignee dropdown open. Added Robin, removed Sam, reopened by Enter, toggled Alex using Tab/Space, and dismissed by Escape with trigger focus restored. Unassigned → Casey and clicking the far edge of Casey's label worked at 390px.
- A click 12px from the far right of the **297×48px** Add task target opened the form; submitting created the sample task. At 360px, clicking the blank right side of the **275×44px** Draft the about page link opened its panel.
- Desktop and mobile outside clicks closed the task; focus returned to the task trigger. Checklist draft `Retain outside-close draft` survived reopening; assignee changes also remained. Inside padding stayed open, and a text-selection drag ending outside did not dismiss.
- The dropdown works inside the modal; first Escape closes only the dropdown. Outside click dismisses both standalone dropdowns and shared account dialogs as intended. Menu stayed within 360/390px viewports, and narrow panel scrollWidth equalled clientWidth.
- Found and fixed a scrollbar reducing the intended phone gutter: final measured x=24px at 390px. Final 360px screenshot showed the full date on one line with readable controls. Captured warnings/errors were empty. Temporary test tabs closed and viewport overrides reset.

Limits: narrow tests used browser-generated pointer/keyboard input, not a new physical iPhone/software-keyboard run. Existing prior physical-phone evidence remains historical, not proof of these changes on that device. The separate critique backlog and sample-data reset limitation remain. Loopback preview refreshed (PID 50365); no hotspot/NAS/public preview was started. User browsing tabs and unrelated local planning/critique drafts were preserved.

Next action: continue Q:M2 / M2.1 foundation planning from the signed-off prototype; do not silently add the wider critique redesign or future AI/email features.


## M1 sign-off — 2026-10-06

**M1.1–M1.6 / Stage 1 are complete as a reviewable sample-data prototype.** This current record supersedes historical pending-check notes below. It is not production readiness or a claim that every usability recommendation has been implemented. M2 has not started.

Closing evidence:
- Physical iPhone / Firefox: the user confirmed Home/navigation, Docs writing/Preview, keyboard hiding/restoring bottom navigation, and the requested board → task → date change → linked Doc → return/close journey ("Everything is fine, date changed succesfully"). Exact phone/iOS/browser versions were not supplied.
- Physical iPhone refresh: user reported "No warnings ... Just resets the data altogether". Record this as observed sample-data reset and **no dependable unload warning**, not a warning pass. Desktop dirty refresh/close warning remains inconclusive; it is a known limitation, not protection for real work. Durable saving is a later-stage requirement.
- Desktop keyboard, supported browser: Skip to content moved focus into main content; Tab traversed Home actions/tasks; Enter opened a task; task fields were reachable; Shift+Tab stayed within the modal boundary; Escape returned focus to the originating task. At the last modal control, focus passed through the browser boundary before returning to the dialog rather than reaching background page controls. Cmd+K, query entry and keyboard result activation opened Launch brief. Formatting/link fields/editor were reachable by Tab; Preview worked by Space. Account choices and Reset demo were keyboard reachable; keyboard Cancel returned to accounts. No captured browser warnings/errors.
- Actual 200% zoom: user confirmed Home, board/task and Launch brief "readable and usable". In the diagnostic tab, DPR changed from 2 to 4 and viewport from 1165×814 to 582×407; Docs Preview had readable wrapped content, visible focus and no page-wide overflow (scrollWidth 575). This was actual scale change, not a viewport-emulation substitute. No viewport override was applied in this pass.
- Prior recorded calendar, Markdown, reset, filter/history/scroll, desktop/narrow and design-skill checks remain valid. Latest application validation: TypeScript, 23 behavioural tests, production build and 16 HTTP checks passed for 8a3ed51. No application code changed during closure, so no redundant build was run.
- Temporary hotspot server PID 48690 was stopped and port 3101 verified to have no listener. The Mac-only preview on 127.0.0.1:3100 was left running. Diagnostic tab closed; user tabs were preserved.

Remaining limitations and next action:
- Prototype edits reset on refresh/closure; no real authentication, persistent storage, uploads, collaboration or connected Assistant exists. Real task saving/restart recovery belongs to M2; durable collaborative Docs remain in M4.
- The separate local UI critique remains a refinement backlog: mobile controls precede tasks, linked Docs sit deep in details, group/status terminology and save conventions need clarification, decorative completion markers and offscreen validation need improvement, and search initially focuses Close. Prototype sign-off does not resolve these findings or certify accessibility. Preserve that report and review it before the next UI change.
- Known environment issues remain recorded: development-only profiler error and previously intermittent browser-policy verification. Neither prevented the completed production-preview journeys.
- Separate local security-planning and critique drafts are preserved and are not included in this sign-off checkpoint. Do not describe the whole working tree as remotely backed up.
- Next: Q:M2 / M2.1 — settle database/authentication and the staff/customer access matrix, then implement one bounded local save/read/restart/migration slice. No NAS/public deployment or spending is authorized by this sign-off. Current account-wide weekly usage: 38% used / 62% remaining; no credits or resets used.


Updated: 2026-10-06 — sign-off checks active; history-scroll regression fixed and verified.

## Delivery state

The user authorised M1.2 through M1.6, with checkpoints, work confined to this project workspace, no credits/resets and no deployment. The existing dark/subtle design is preserved. Data is fictional and in memory: edits and drafts survive internal navigation, then reset on refresh/tab closure. No real authentication, database, uploads or collaborative editing exists.

| Increment | Implemented | Actual checks | Acceptance |
| --- | --- | --- | --- |
| M1.1 | Existing design specification | Prior planning review | Complete |
| M1.2 | Shell/navigation, search, sample accounts, field metadata, modal scroll containment | TypeScript/build; HTTP 13/13 | Accepted prototype; evidence above |
| M1.3 | Personal overdue/today/upcoming/undated work, empty-state preview, recent Docs, shared state and task opening | Model 7/7; TypeScript/build; HTTP 14/14 | Accepted prototype; evidence above |
| M1.4 | Grouped tasks, add/rename/date/status/priority/multiple assignees, URL-backed combined filters/collapsed groups | Model 7/7; TypeScript/build; HTTP 15/15 | Accepted prototype; evidence above |
| M1.5 | Task notes/checklists/subtasks, sample file metadata, document linking, Markdown writing/formatting/safe preview and return context | Final model/Markdown/navigation 15/15; TypeScript/build; HTTP 16/16 | Accepted prototype; evidence above |
| M1.6 | Direct browser review, in-page calendar replacement, Docs preview refinements, Assistant · Later navigation | See current review below | Accepted prototype; limitations above |
| M2–M5 | Not implemented | — | Open |

M1 delivery items are reconciled in SESSION_CHECKLIST.md against the recorded prototype acceptance evidence. Historical pending notes below are retained as a diagnostic log.

## Preview

Local development server was running and responding at **http://127.0.0.1:3100/home** after the final HTTP checks. Server lifetime is session-dependent; see RUNNING.md to restart. It is bound to this Mac's loopback address, not publicly exposed or deployed to the NAS.

Try Home → a task → linked Launch brief → edit text → Preview → Back to task → Close. Boards support editing/filtering. The sample account dialog includes Reset demo with confirmation. A refresh/close warning is registered after session changes, but physical iPhone Firefox refresh showed no warning and reset sample edits. Do not rely on it to protect work.

## Checkpoints

Git is initialised inside this existing project folder, as instructed. `origin` is `https://github.com/peterkontellis-spec/WorkspaceApp.git`. Author is repository-local **Workspace Checkpoint Agent <checkpoint@localhost>**; no global Git identity was changed.

| Local checkpoint | Commit/tag | Purpose |
| --- | --- | --- |
| Baseline | `3267038` / `baseline-2026-10-05` | Original shell, design and self-check instructions |
| M1.2 | `5a7b9cd` / `m1.2-implemented` | Targeted shell refinements |
| M1.3 | `ec90365` / `m1.3-implemented` | Home, shared state, initial task panel |
| M1.4 | `736daa9` / `m1.4-implemented` | Grouped board editing/filtering |
| M1.5 | `m1.5-implemented` | Connected task/Docs prototype and review fixes |

**Remote backup verified:** the user completed GitHub CLI sign-in as `peterkontellis-spec`. The five implementation checkpoints and all five milestone tags were pushed atomically to `origin`; `main` tracks `origin/main`. Initial HTTPS/SSH authentication failures are resolved through the project-local HTTPS credential helper. Credentials and the CLI binary remain outside tracked source, inside Git's local metadata/configuration or the OS credential store.

Review the latest code at [WorkspaceApp](https://github.com/peterkontellis-spec/WorkspaceApp), [commit history](https://github.com/peterkontellis-spec/WorkspaceApp/commits/main), or [milestone tags](https://github.com/peterkontellis-spec/WorkspaceApp/tags).

The October 5 ZIPs in the parent output folder are verified historical snapshots. They predate this implementation; the working tree and Git history are now the authoritative continuation source.

## M1.2–M1.5 checkpoint verification (historical)

- `pnpm check`: TypeScript, **15 behavioural tests**, and production build passed.
- `pnpm check:smoke`: **16/16 HTTP checks** passed. These check redirects, page headings/disclosures, filtered server-rendered rows, task-notes/editor surfaces, contextual return-link markup and unknown-route status. They do not execute browser JavaScript.
- Model tests cover immutable edits, validation, date/assignment buckets, combined filters, independent group/status, add-task IDs, document identity/recency and reset. Markdown tests cover formatting, empty text, safe HTTP(S) links and inert raw HTML. Navigation tests cover safe return destinations and preserving filters while opening/closing tasks.
- Impeccable context loaded from the incumbent implementation/specification. Mechanical detector on components/CSS returned `[]`. Source reviewed with Impeccable, current Web Interface Guidelines and React best practices. No visual/accessibility score is claimed.
- Independent source review led to fixes for URL filter-control synchronization, focus fallback after edited tasks leave a list, recent-document ordering, and draft retention. Board rename/date/new-task and task checklist/subtask input now live in shared session drafts.
- `git diff --check` passed before checkpointing. No new runtime dependency was added.
- Latest usage check: **89% of the reported weekly allowance remained**, ordinary usage allowed. No credits, purchases or resets used.

## M1.6 review and diagnostics — current evidence

The user accepted the rough navigation pass and authorised M1.6, then asked the assistant to run checks itself, diagnose the crash, replace the native date picker, add Assistant · Later, and investigate mobile preview. No second agent was needed. Earlier browser access became available long enough to run the checks below; this does not establish that all previous acceptance boxes passed.

### Browser checks actually performed (before refinements)

Using the supported Codex in-app browser, desktop viewport override 1440 × 900 and narrow overrides 390 × 844 / 360 × 800:

- Home → task → linked Launch brief → Back to task → Escape passed. Notes, a new checklist item and unfinished subtask input survived navigation. Focus returned to the original task link.
- Combined status/priority filters narrowed the board to one task. Changing its status removed it from the filtered list; Escape returned focus to visible main content. Clear filters restored rows; status did not move the task's group.
- Blank task title showed an error. Creating and renaming a task, selecting multiple assignees, and changing priority worked.
- Home empty-state preview displayed its explanatory text and restored sample work when unchecked.
- Cmd+K replaced an open account dialog with search. No-result search and keyboard navigation to Launch brief worked.
- Markdown headings, bold, italic and lists rendered; raw script markup remained inert text. Unsafe link insertion showed validation; a valid HTTPS link was inserted. Bold formatting restored the editor's selection and focus.
- Desktop Home and side panel, narrow task panel and 360px Docs were visually inspected. The 360px Docs Preview tab and output were visible; document scroll width did not exceed viewport width. This was emulated layout, not a real phone or software-keyboard test.

### Failure register and actions

1. **Native calendar popup crashes the embedded browser (P1).** Reproduced twice: board → due-date edit → Show date picker → tab becomes “This page crashed”. Home and board still returned HTTP 200; Node remained listening, and the app logs showed no application exception. Keyboard day increment then Save worked (25 → 26 September). Evidence points to the embedded native popup; its internal crash cause is unconfirmed. Replaced both board/task native date inputs with a shared in-page calendar, including clear, month navigation, arrow/Home/End/Page keys, Escape and focus return. **Implementation and calendar logic tests pass; browser confirmation pending.**
2. **Mobile preview concern (open until confirmation).** Missing Preview could not be reproduced at 360px: the button and rendered text were visible. Scrolling away from the mode controls remains a usability concern. Made Write/Preview sticky, added scroll-to-editor-start on switching, and protected focused controls from the sticky bar. **Final mobile interaction and physical keyboard checks pending.**
3. **Link inside bold/italic preview rendered literal Markdown (P2).** Reproduced via Bold → Insert link → Preview. Extracted the renderer and render nested inline content safely with a depth bound. **Regression rendering tests now pass; browser confirmation pending.**
4. **Date/empty-text tool fill did not consistently update React state.** Date DOM value changed while its controlled attribute stayed empty; real keyboard date editing passed. Empty-text fill likewise did not produce an empty preview. Do not count these as passes or conclude the model is faulty. The real empty renderer now has a test; repeat the UI check with actual Select All/Backspace when access returns.
5. **Framework smooth-scroll warning (P3).** Added the documented HTML data attribute matching existing CSS. Build passes; confirm the console warning is gone in the browser.
6. **Final browser access blocked.** After the initial pass, the supported tool again reported that its admin-enforced policy could not be verified and denied access to 127.0.0.1. Later retries returned the same denial. No alternate browser or renderer bypass was used. The viewport override was reset and a working preview tab retained. This is separate from the reproducible calendar crash.

### Current refinements and verification

- Assistant · Later is a disabled, labelled button in desktop/sidebar and mobile-menu navigation. It reserves the discussed local helper / optional Astra concept only; no AI service, credentials, cloud routing or spend enabled.
- Existing visual identity preserved. Sidebar can scroll on short desktop windows after the additional entry.
- `pnpm check`: TypeScript, **20 tests**, and production build passed after the calendar/renderer integration. Tests include leap years, calendar boundaries/DST, nested links and inert unsafe markup. A first-pass TypeScript narrowing error was corrected before the successful run.
- Impeccable context and current Web Interface Guidelines loaded; source review covered labels, focus, HTML semantics, overflow, state honesty and dark tokens. Mechanical detector returned `[]` on the main refinement batch. React best practices applied; no runtime dependency added. No complete accessibility or performance score is claimed.
- `pnpm check:smoke`: **16/16 HTTP checks passed**, now also checking Assistant · Later and that task routes render the replacement date control without native date inputs.
- `git diff --check` and edited-document link checks passed. Final source includes a scrollable short-window sidebar; the last full typecheck/test/build run passed.
- Usage check: **82% of the weekly allowance remained**, ordinary usage allowed; no purchases, credits or resets used.
- Saved as an M1.6 progress checkpoint; acceptance remains open. See Git history for the commit.

## Browser retry and reset confirmation — 2026-10-06

Supported browser access recovered temporarily. The preview server had stopped and was restarted. Actual browser checks confirmed:

- 360px Docs: switching from a scrolled editor to Preview displayed the text at the editor start; no horizontal overflow (360px viewport and scroll width). Bold/italic links rendered as real HTTPS links; raw HTML and unsafe URLs remained text. At 390px, Select All/Backspace produced the empty preview.
- Assistant · Later was visible and unavailable in desktop navigation and the 390px mobile menu.
- 390px board calendar: mouse selection and Save changed 25 to 26 September. Keyboard Page Down changed the month; choosing another date then Cancel preserved 26 September. Desktop task calendar crossed into January 2027, selected by Enter, closed with Escape while retaining task details, and cleared the date successfully. No calendar crash occurred.
- Checklist completion and subtask status changed successfully. Sample account changed to Sam, persisted through navigation, and Home reflected the cleared date in Without a date. Browser Back/Forward restored filters and the collapsed Next group.
- Reset demo's native confirmation caused browser-tool timeouts twice. The user confirmed seeing the popup outside the preview while browsing settings; this was not proof of an app reset failure. Replaced it with the existing in-page Dialog pattern to keep confirmation visible and testable. Desktop (1024px) and phone (360px) screenshots inspected. Cancel and Escape preserved edited text/account; explicit Reset sample data restored the original document and Alex account, with focus returning to the account trigger.
- Unknown board/document pages rendered the recovery link in the production build; Back to Home worked. Development mode exposed a framework profiler error: `flushComponentPerformance` called `performance.measure` with a negative end timestamp on an errored route. Production did not reproduce it. No dependency patch or upgrade was made; development-mode issue remains recorded.

Validation: `pnpm check` passed TypeScript, 20 tests and production build; `pnpm check:smoke` passed 16/16 against development and was rerun against the final standalone preview. Impeccable detector returned `[]` for the changed shell/CSS. Scoped Impeccable, Web Interface Guidelines and React review covered existing dialog semantics, keyboard focus, wrapping actions, labels and responsive layout. No full accessibility/performance score claimed.

Preview now uses the built standalone server on the same loopback address, with public/static assets copied into generated output. An initial `pnpm start` emitted a standalone-launcher warning; it was replaced with the supported standalone command. On the final browser reload, policy verification failed again. No bypass was attempted; viewport override was reset. The final standalone launch has HTTP evidence only; production browser evidence above came from the same build under `next start` immediately before the launcher switch.

Remaining: refresh/close warning interaction, physical phone/software keyboard, full viewport coverage of every screen, and exact task→Doc→task scroll/collapsed/filter preservation matrix. Development profiler issue remains open; M1.6/Stage 1 are not closed. Usage: 77% of weekly allowance remained; no credits/resets/purchases used.

## Browser recovery follow-up — 2026-10-06

The supported browser could inspect the app, but navigation produced connection refused: port 3100 had no listener. Restarted the existing standalone production preview on 127.0.0.1:3100 in a separate process session, logging only inside `.git/preview-server.log`; no system service was installed. The generated connection-error data URL was denied by browser tooling. A fresh tab in the same browser at the original local origin restored access. Home → Website refresh → Home passed and the tab reported no captured warnings/errors. The server was still listening on a subsequent check. The intermittent admin-policy verification failure did not reproduce in this retry; its cause and long-term preview lifetime remain unresolved. No security policies or permissions changed. This bounded recovery check does not close M1.6 acceptance.

Saved the conversation/usage constraints in HANDOFF_REPORT.md. Documentation-only update: reviewed content and local links, and ran `git diff --check`; no application code changed or redundant build was run. Next: verify refresh/close warning and task/Docs return-context preservation while browser access works, warning the user before tests that may show browser prompts.

### Explicit site approval verified — 2026-10-06

A subsequent read of the existing diagnostic tab was rejected by automatic approval review: it interpreted site access as potentially changing origin permissions without explicit authorization. This was a distinct rejection from the earlier inability to verify admin policy. After the risk explanation, the user explicitly approved browser access to `http://127.0.0.1:3100`. Retrying the same tab through the same supported tool succeeded. Home → Launch brief → Preview and a clean page refresh all passed; captured browser warnings/errors were empty. The user's separate preview tab was not manipulated. No browser protections were disabled, no configuration files were changed, and no alternate control path was used. Current access denial is resolved; the earlier intermittent verification error was not reproduced and is not proven permanently fixed. No further user settings change is needed now. The clean refresh did not test the unsaved-changes warning.

## Pre-M2 reconciliation — 2026-10-06

**Handoff position:** M1.2–M1.5 are implemented and the core journeys have browser evidence. M1.6/Stage 1 remain formally open for the explicit gaps below. M2 has not started. The coherent screen structure supports M2.1 architecture/data planning now; do not describe M1 as fully accepted or silently discard these checks.

Additional checks in the supported in-app browser at its default **1165 × 814** viewport:
- Filtered Website refresh to Sam, collapsed Next, opened Gather content references → Content outline → Back to task → Escape. Filter and collapsed state survived; page scroll was **436.5 px before and after**, and settled focus returned to Gather content references. No captured browser warnings/errors. This establishes one desktop return-state case, not the full device/history matrix.
- Home's new-collaborator preview showed an explanatory empty state and a shared-boards link. Unchecking restored assigned tasks; sample boards remained present.
- Entered temporary text in the diagnostic Launch brief, then requested refresh. The text remained; the browser exposed no JavaScript dialog and its screenshot contained no warning. The reload/close warning is **inconclusive**, not passed. Do not rely on this warning to protect real work. Only diagnostic-tab sample state was changed; the user's separate browsing tab was untouched.
- Scoped source/UI review used Impeccable and the fetched Web Interface Guidelines for navigation, shared dialog and unload handling. Visible keyboard focus, semantic links/labels, dark tokens and modal scroll containment were present; detector returned `[]`. No new confirmed source defect in this scope; warning verification remains a gap. No global accessibility/performance score or physical-phone coverage is claimed. No application code changed, so the existing 20-test/build/16-HTTP results were retained rather than rerun.

### Open register to carry into M2

| Item | State and next action |
| --- | --- |
| Unsaved refresh/close warning | Inconclusive in the embedded browser. Perform a user-observed refresh/cancel/leave and tab-close check with disposable text; record actual dialog and retained/lost text. Warn before prompts. |
| Responsive/keyboard coverage | Existing 360/390/1024/1440 evidence is partial. Finish screen-by-screen Home, both boards, Docs lists/editors, task panels and dialogs; verify focus/Tab/Shift+Tab and 200% zoom. Do not infer a full matrix from one screenshot. |
| Return-state matrix | Desktop filtered/collapsed/scrolled task→Doc→task now passes. Confirm the corresponding narrow-layout and browser Back/Forward variants; prior Home and history tests remain valid but are not every combination. |
| Physical phone/software keyboard | Untested. Requires an authorized phone-accessible test setup; current 127.0.0.1 link is only on this Mac. No LAN/NAS/public exposure was enabled. |
| Native warning/tool behavior | Native Reset confirmation was replaced and verified in-page. Browser-owned unload warning remains separate; do not reintroduce native date picker or reset confirmation. |
| Next.js development profiler | Negative-time `performance.measure` error on not-found route in dev remains unresolved; same production build/recovery passed. Reproduce in an isolated dev session before choosing a dependency fix. |
| Browser policy / preview lifetime | Explicit local-site approval restored current access. Earlier intermittent verification failure remains unproven; preview is a local process, not an installed managed service. Recheck server and browser separately if it returns. |
| Security-planning drafts | BRIEF.md, DECISIONS.md and STATUS.md contain pre-existing planning edits; SECURITY_CHECKLIST.md is untracked. Preserved locally, not included in this checkpoint. Review and checkpoint separately before a repository-only handoff. All security controls are unimplemented/unverified. |
| M2 scope/model decision | Reconcile internal owner/editor/viewer roles with the separate proposed admin/customer-folder boundary before schema/auth decisions. Customer count and access actions are unresolved; four staff is not a measured customer capacity. |
| Future ideas | Assistant is a disabled placeholder. NAS AI, heavy-task routing, admin email ranking and mobile push are proposals, not implemented or silently added to M2. |

**Next session: Q:M2 / M2.1.** Read AGENTS.md, this section, HANDOFF_REPORT.md, BRIEF.md, DECISIONS.md and the local SECURITY_CHECKLIST.md. Choose and document the database/authentication approach against NAS constraints, define the access matrix and schema, then deliver one local save/read/restart/migration slice with tests. Preserve design and carried M1 checks; no deployment, purchases, credits or resets. Latest usage snapshot: **27% used / 73% remaining** account-wide.

## M1.6 sign-off pass in progress — 2026-10-06

The user requested final checks and offered to run a physical iPhone/Firefox test. That test is **not yet running**. The user connected the Mac through a phone hotspot and asked about safety; explicit confirmation to start a temporary network-accessible sample preview is pending. Read-only inspection returned Wi-Fi IP `172.20.10.2`, consistent with a hotspot, but this alone does not prove network identity. Do not bind to shared Wi-Fi or all interfaces. If approved, bind a separate preview only to the confirmed hotspot address and stop it after testing; no NAS, router or public deployment is authorized. Current production preview remains loopback-only on port 3100 (PID 48235 at this check).

**New failure found and fixed:** at 360 × 800, filtered Team operations → task → Weekly notes → browser Back → Forward → Back to task restored the filter/collapsed group but jumped from **674 px to 0 px**. Scroll memory was consumed on the first return. The implementation now retains the origin for repeated history returns, and fresh task-opening clicks from Home/boards replace the remembered position. No visual redesign or persistence change.

**Verified after fix:** the same narrow journey retained **674 px** through Back and explicit return, preserving `assignee=alex`, `collapsed=Next`, and focus on task t7 after Escape. At 1440 × 900, Home → Prepare launch brief → Doc → Back → Forward → Back to task retained **251.5 px**, with focus returning to t1. Captured warnings/errors were empty. Native task dialog keyboard traversal remained in the dialog; a complete forward/reverse tab-order matrix and browser zoom are still not signed off.

**Visual evidence added:** desktop Home, Boards list, Docs list, Weekly notes editor, and task panel with board context; 360px Weekly notes Write/Preview, Docs/Boards lists, Team operations controls and task panel. No horizontal page overflow in measured narrow document/task states (scroll width 345, viewport 360). Together with earlier calendar, Launch brief/Content outline, reset and 390/1024 checks this extends coverage; physical keyboard/touch and 200% zoom remain distinct gaps.

**Validation:** `pnpm check` passed TypeScript, **20 tests**, production build; restarted the standalone preview and `pnpm check:smoke` passed **16/16**. Source review followed React best practices plus Impeccable and current Web Interface Guidelines; mechanical detector on all five changed components returned `[]`. Reviewed change scope and `git diff --check`. No dependency upgrade, spending or policy change.

**Still not signed off:** user-observed refresh/close warning, physical iPhone/Firefox keyboard/touch, remaining keyboard/zoom checks, and the historical development-only profiler/policy issues (not reproduced/fixed by this change). Mobile `beforeunload` cannot be treated as a universal data-loss guarantee; browser documentation notes unreliable delivery on mobile. M2 must provide real durable saving, not rely on a warning. Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event

**Immediate continuation:** obtain the pending hotspot confirmation, start a narrowly bound temporary sample preview if approved, guide the user through one phone check at a time, record their device/browser/results, stop that server, and finish the remaining desktop keyboard/zoom checks before updating the final acceptance gate. M1 remains open. Do not start backend implementation while this explicit sign-off request is active.

### Assisted phone test started — 2026-10-06

User explicitly confirmed the Mac is on their iPhone hotspot and authorized a temporary preview. Started the existing production sample build bound only to **172.20.10.2:3101**; HTTP 200/Home content and the exact listener were verified. Firefox on iPhone is the target browser. The original 127.0.0.1:3100 preview remains unchanged. No firewall/router/NAS settings changed. Supervisor PID 48456, preview PID 48457; process metadata/logs are in `.git/hotspot-preview.json` and `.git/hotspot-preview.log`. Automatic maximum lifetime is 30 minutes; stop sooner when testing ends. Check current process/listener state rather than assuming these PIDs are still active. First user check pending: Home loads and bottom Home/Boards/Docs navigation is visible. Do not mark physical-phone acceptance until the user reports results.

### Phone keyboard/navigation fix — 2026-10-06

Physical **iPhone / Firefox** feedback: Home and bottom navigation load; Docs typing, scrolling and Preview work. The user reported that only the top portion of the bottom-navigation buttons remained visible with the software keyboard, creating accidental-tap risk. This is a verified defect, not a passed phone check.

Implemented keyboard-aware bottom navigation using focused text-entry state and VisualViewport height normalized for pinch zoom. The navigation is fully hidden (including hit targets/accessibility tree) while the keyboard occludes the narrow viewport, and returns when the visible height recovers even if the input retains focus. Regular text focus with a hardware keyboard and browser toolbar changes should not hide navigation. One shell-level listener set is cleaned up on unmount; existing layout spacing remains to avoid a page jump.

Validation: TypeScript, **23 behavioral tests**, production build and **16/16 HTTP checks** passed. New tests distinguish keyboard opening/dismissal, hardware focus, toolbar height, short windows and pinch zoom. Impeccable detector returned `[]`; scoped React and interface review checked listener cleanup, semantic hidden state and preserving navigation without a software keyboard. Supported browser at 390 × 844 confirmed editor focus leaves navigation visible without a software keyboard; desktop 1440 × 900 remained unchanged and no warnings/errors were captured. Viewport override restored. **Actual keyboard hide/restore on the iPhone was subsequently confirmed by the user; see the current closing checklist.**

Both previews restarted with this build: loopback PID 48688; hotspot supervisor 48689 / server 48690, same 172.20.10.2:3101 with a renewed maximum 30-minute lifetime. No network scope broadened. First next action is the pending user phone retest, then continue calendar/task return and warning checks; stop the hotspot preview after testing. M1.6 is still open.

## Next action

Continue with the Q:M2 / M2.1 planning and bounded local foundation slice described above, preserving the open M1 register. No M2 code was implemented in this roundup.
