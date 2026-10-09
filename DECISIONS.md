# Decisions

## M4.2 reminder policy — 2026-10-09

The user confirmed the proposed default: current assignees receive one in-app deadline reminder at 09:00 Europe/Athens on the due date; a missed reminder catches up after restart, and completed/archived tasks do not send. They also requested an option to opt into additional reminders. The bounded implementation offers per-task “One day before” and “One day overdue” options, both at 09:00 Athens, off by default. These shared task settings affect current assignees and are explicitly labelled that way. Owners/editors save them with the normal task revision; viewers read them. Arbitrary schedules, personal preference pages, email/push and recurrence are outside this increment.

Use the existing PostgreSQL database for durable jobs, with a small sequential worker in the running app process. Store each due-date/offset occurrence once and commit its notifications atomically with delivery state. Recheck task, board, assignment and enabled-account state under the existing workspace/access locking protocol. System reminders must not invent a user edit or change the task revision. After downtime, only the latest elapsed eligible occurrence per task/deadline is delivered, rather than all missed optional reminders. Already delivered occurrences do not repeat after retries, reopen/restore, or changing away from and back to the same due date.

Existing deadlines before activation day are not automatically backfilled. Actually changing the date or enabling an additional reminder intentionally activates an old task; an unchanged full-form save must not activate it accidentally. Template copies reset additional options, consistent with fresh dates/assignees. Durable Docs remains held for NAS configuration. [JOBS.md](JOBS.md) records implementation and verification boundaries; M4.2 is locally verified; STATUS.md records actual checks and remaining environment/release gates.

## M4.1 advisory dependencies and preview refinements — 2026-10-08

The user authorized M4, superseding the earlier stop-before-M4 boundary. M4.1 is the bounded first increment: task prerequisites warn but allow completion, as explicitly selected. Reopening or archiving a prerequisite must never automatically change a dependent task’s status. Owners/editors edit shared prerequisites; viewers read. Retain links through archive, reject self/cross-workspace/circular links, serialize competing graph edits and save dependency changes atomically with the task revision/details/activity. Templates remap internal links only when both endpoints are copied, omit external links and preserve older immutable snapshots.

The user also requested board filters as a popup and clickable Workspace/section breadcrumbs. Preserve existing search, URL/view/month filtering and approved themes. Apply commits filter choices; outside click, Escape, Cancel and Close discard unsubmitted advanced choices. Workspace leads Home; each section label leads its main page. Narrow headers retain both links with usable touch targets.

The user explicitly requested `test@test.com` for local general testing and subsequently upgraded it to owner. Keep credentials private. Remove this login entirely before any publication/external release, including credential/session/recovery/invitation access; verify account absence and rejected sign-in while preserving legitimate shared work/history. This standing gate is documented in AGENTS.md and the release checklists, not automated cleanup. The actual existing preview owner email is `preview@example.test`.

M4.2 scheduled jobs/reminders follows verified M4.1. Durable Docs remains held until NAS configuration is settled. No publication, LAN/NAS access, spend, credit or reset authorization is added.

## M3.6 template rules and stop before M4 — 2026-10-07

The user authorized completion through the end of M3, stopping before M4. Use independent immutable snapshots of saved board/task structures: copy title/instructions/priority/groups/column definitions/active subtasks/checklist labels; reset task status/checklist completion/due dates/assignees; retain text/number custom values and clear date/status/link values. Exclude attachments, time and prior activity. Plain-text notes, including embedded URLs, copy verbatim; documents are not duplicated or connected. Durable Docs remains deferred.

Templates are shared staff work. Owners/editors save/apply; viewers read. Archive/restore follows the adopted work boundary: task templates owner/editor, board templates owner only. Reuse matching destination columns one-to-one; add missing definitions within the existing limit; reject incompatible same-name columns atomically. Snapshot bounds are 200 tasks,100 groups,20 columns,2 MiB. Save a new template to revise its contents.

The source root revision is checked, but capture includes the latest saved descendants at transaction time (board revision is not a whole-project version). Show this explicitly. Keep draft input/retry identity; require an explicit version reload after conflict rather than silently rebasing. M3.7 local integration can close on executed four-account evidence, while physical/browser-host acceptance stays visibly pending. M4 and NAS/publication work are not started by this authorization.

## Time-tracking policy and semantics — 2026-10-07

The user confirmed shared time-entry visibility, with owners/editors changing only their own time and viewers read-only. No owner override for another person's entries. M3.5 implementation choices: one stored running timer per person, server timestamp duration, original timers split at local midnight, manual entries/corrections allocated to their selected work date, recoverable void/restore and retained original/audit history. Archive/access loss stops active timers in the same transaction; restoring access does not restart them. Existing work is never backfilled as time. Current-month defaults and a maximum 93-day inclusive report range bound queries. No new service or star scoring. See TIME_TRACKING.md for exact behavior and STATUS.md for checked evidence.

| Date / source | Decision | State and reason |
| --- | --- | --- |
| Existing PLANNING.md baseline | Self-host on UGREEN DXP2800 for up to four people; NAS-resident data and Docs; no required Google Drive | Confirmed in baseline; central product constraints |
| Existing PLANNING.md baseline | Approximately 4 GB app memory budget | Design constraint; actual usage must be measured |
| Existing PLANNING.md baseline | Deliver prototype, foundation, team workflow, advanced behavior, then NAS rollout | Existing delivery sequence; all confirmed features retained |
| Existing PLANNING.md baseline | React/Next.js/TypeScript, PostgreSQL, Tiptap/Yjs/Hocuspocus, Docker Compose | Proposed, not installed or finalized; validate when implementation begins |
| Existing PLANNING.md baseline | Comments/mentions, private boards, and inbox remain optional | Not approved; do not add silently |
| 2026-09-25 — user request | Apply the AI workflow to the workspace app | Confirmed in this conversation |
| 2026-09-25 — implementation choice | Keep instructions and progress documents directly in workspace-app | Reversible setup choice so the workflow travels with the project |
| 2026-09-25 — implementation choice | One coordinating assistant; bounded specialist assignments; main assistant owns shared records | Reduces conflicting edits and provides one integrated result |
| 2026-09-25 — user request | Break the five stages into small increments and provide a Markdown pre-session checklist | SESSION_CHECKLIST.md is the user-facing roadmap; STATUS.md stays authoritative for current progress and MILESTONES.md for stage acceptance. No additional product features or implementation are implied. |
| 2026-09-25 — M1.1 user preference replies | Dark workspace with subtle accents; equal desktop/phone focus and larger controls | Confirmed user direction. Phone task work and document writing receive equal design attention; no desktop-first assumption. |
| 2026-09-25 — M1.1 design proposals | Palette, type/size ranges, phone Home/Boards/Docs navigation plus full menu, task/document return behavior | Provisional details in DESIGN_SPEC.md; refine in the prototype. Final name/branding remain open. |
| 2026-09-25 — M1.1 delivery boundary | Screen/interaction specification only; runnable shell starts at M1.2 | Current request authorizes M1.1. Sign-in is conceptual; live accounts, saves and document collaboration remain later work. |
| 2026-09-25 — user request | Implement M1.2 locally | Shell/navigation scope authorized; no NAS or external deployment. Later detailed screens remain incremental. |
| 2026-09-25 — M1.2 implementation | Next.js 16.3.6, React 19.3.0, TypeScript, lucide-react 1.48.0; pnpm 11.25.0 lockfile; plain CSS | Frontend proposal adopted after official-documentation and registry checks. Minimal frontend dependencies; no database, auth, office/editor service, or cloud requirement added. |
| 2026-09-25 — M1.2 implementation | Real local routes with shared fictional fixtures; in-memory sample account; native dialog primitives | Supports shell navigation and later increments while labelling sample roles/content honestly. Account selection resets on refresh. |
| 2026-09-25 — M1.2 environment | Local server at 127.0.0.1:3100; standalone output configured for eventual self-hosting; generated agent rules disabled | Loopback preview only. Preserve project instructions; actual NAS packaging remains M5. |
| 2026-09-25 — M1.2 verification | Keep visual/keyboard/navigation acceptance pending | Browser tool refused access because its admin-enforced security policy could not be verified. No alternate browser mechanism was used to bypass the restriction. Build/source checks do not replace browser QA. |

Record later material changes with their rationale and authority. Preserve whether a decision is confirmed or proposed. Do not infer approval of deployment, purchases, or optional product features from this setup request.

## 2026-10-05 — required checks before task completion

The user requested a self-check loop that actually runs/tests the app, reviews it against design/UI skills, fixes failures, and reassesses the next action before closing. They selected **after each task/session only**, with no automatic daily review. AGENTS.md defines the standing loop; SESSION_CHECKLIST.md includes its closure gates. `pnpm check` and `pnpm check:smoke` provide repeatable build and HTTP checks. Browser checks and skill reviews remain explicit assistant actions, and blocked checks leave the affected feature incomplete. Preserve the current design and confirmed scope; this instruction does not authorize deployment or a redesign.

## 2026-10-05 — prototype execution and checkpoint policy

The user handed off M1.2–M1.5 and authorised commit/push checkpoints to WorkspaceApp, with work restricted to the existing project workspace and no credits/resets. Preserve the shell and existing design. A minimal task panel moves into M1.3 to support its task-opening requirement; M1.5 expands it. Shared in-memory state stays above routes so edits survive navigation but not refresh. Browser denial does not authorise bypasses or a completion claim; implementation continues under the latest handoff with acceptance explicitly pending. GitHub pushes are waiting for authentication; local commits remain available.

## 2026-10-05 — M1.5 implementation details

Prototype Docs use a small Markdown text/preview editor with formatting controls and only safe HTTP(S) links. No additional runtime dependency, raw HTML execution, cloud editor or persistence is introduced. Fixed document titles keep this increment focused on writing; real editor/collaboration choices remain M4. Edits promote the document in session recency. Board/task drafts remain in the shared provider through navigation, and changed sessions register a refresh/close warning. Native task dialogs preserve visible desktop board context and use the full phone width; rendered behavior remains pending verification. Checkpoints are named implemented, not complete.

## 2026-10-05 — GitHub authentication and upload complete

The user completed GitHub CLI browser sign-in. The assistant configured an HTTPS credential helper in this repository only and pushed `main` plus baseline/M1.2/M1.3/M1.4/M1.5 tags atomically to the supplied WorkspaceApp remote. Future authorised checkpoints can be pushed from this project. The CLI binary and authentication configuration live under untracked `.git` metadata, with the credential reported in the OS keyring. Earlier authentication-block notes are historical; STATUS.md is current. No source changes, credits, resets or deployment were involved in this upload step.

## 2026-10-05 — M1.6 review refinements

- User authorised assistant-run browser testing and fixes, plus an Assistant · Later navigation placeholder. Local AI with optional Astra handoff remains proposed future work; no service, spend or deployment is authorised by this placeholder.
- Replaced native date inputs with an in-page calendar after two embedded-browser crashes on opening the native popup. App HTTP responses remained healthy and keyboard date edits worked; browser internals were not diagnosed. Preserve ISO date-only values and existing board Save/Cancel vs task immediate-update semantics.
- Keep Docs mode controls reachable while scrolling and bring the editor start into view on mode changes. A 360px pre-fix inspection showed Preview content, so the user's complete mobile visibility concern remains to be confirmed after the refinement.
- Never close M1.6 solely on automated results: final browser access was denied by admin-policy verification after partial direct testing. STATUS.md records each failure and remaining check.

## 2026-10-06 — M2 authorization and foundation choices

The user requested an M2 outline and implementation, and explicitly confirmed a shared staff workspace with owner/editor/viewer access; customer access and private admin material remain separate. Continue bounded tested checkpoints under the existing no-spend/no-reset/no-deployment constraints.

Adopt PostgreSQL 18 with the pinned pg driver, a small server-side pool and explicit transactional/checksummed SQL migrations. Use the pinned embedded-postgres package only for project-local development and integration tests; production PostgreSQL packaging remains M5. All local database data and generated credentials stay under ignored `.local/`. The runtime role cannot alter schema/history. Keep the M1 UI clearly sample-only until authenticated persistence is wired in M2.4.

Select Better Auth with PostgreSQL for M2.2; its authentication schema will be generated from the reviewed pinned configuration then, not hand-invented now. Password/session handling, local owner setup, invitations, recovery without an assumed mail provider and stronger admin/customer requirements remain to implement/test. Staff workspace ownership does not imply portal administrator or NAS privileges. [DATABASE.md](DATABASE.md) records the exact boundaries and remaining gates.

## 2026-10-06 — M2.2 accounts and operator recovery

Adopt pinned Better Auth 1.7.7 with generated/reviewed PostgreSQL schema and a separate binding to application membership. Public signup is disabled; local first-owner setup is the sole bootstrap path, and M2.3 will add invitations. The user explicitly chose a local operator verifying identity and issuing a one-use 15-minute recovery link, with no email provider assumed. Recovery revokes sessions and replaces earlier outstanding links.

Use eight-hour absolute sessions and a 30-minute idle cutoff refreshed by actual activity, not passive polls. Require exact-origin JSON auth writes, bounded bodies, host-only HttpOnly/SameSite cookies and Secure on HTTPS. Loopback HTTP is a development exception; forwarding headers are not trusted. Missing auth configuration fails closed; anonymous sample mode requires an explicit setting. These choices do not establish production readiness. Preserve sample-only editing disclosures until M2.4; staff ownership is separate from portal admin/NAS privileges. See AUTHENTICATION.md and current STATUS.md for evidence and remaining gates.

## 2026-10-06 — M2.3 membership and invitations

User “Go on” continues the authorized M2 plan. Owners issue email-bound one-use 24-hour links and manage staff membership; editors/viewers can read the team. Links are shared manually; no email provider is connected. Reserve pending invitation seats within the initial four-person workspace. Prevent removing/demoting the final active owner, revoke sessions on role/removal, preserve removed identities/work, and cancel invitations whose issuer loses owner authority. The local operator remains a separate privileged boundary.

A reinvited person proves their existing password rather than replacing the account. After independent operator identity verification, an active removed identity may recover only while a valid pending invitation from an active owner exists; recovery alone grants no membership. Serialize mutations with a bounded per-pool queue plus database workspace locks to avoid exhausting the small connection pool and preserve cross-process correctness. Keep task-role claims explicitly future-facing until authenticated task endpoints arrive. MEMBERSHIP.md records limits; final browser acceptance remains governed by STATUS.md.

## 2026-10-06 — M2.4 saved-work boundary and recovery

Authenticated Home/Boards use stored staff-workspace records; the original fixtures remain only in explicit prototype mode and sample Docs. Owner/editor task permissions are enforced on the server under the same workspace lock used for membership changes. Viewers can read. No private admin/customer access is implied.

Updates retain an original revision and reject stale writes. Create forms retain a random entity UUID so an uncertain network retry cannot create duplicates; retries return the current record rather than replaying fields. Unsaved forms/task drafts are kept only in tab memory across navigation, with explicit discard and a warning on refresh where supported. No offline queue or durable draft promise. Numeric group/task order is the initial ordering UI. See SAVED_WORK.md.

## 2026-10-06 — M2.5 custom fields and local preview isolation

Keep each board's column definitions independent. Validate values and original column revisions alongside the task revision in one transaction. Save notes and the full checklist atomically with task fields. Protect populated definitions: permit rename/order and unused status-option changes; refuse type/number-format/currency changes while values exist. No implicit data conversion or column deletion. Limits are 20 columns, 20 status options, 50 checklist items and 50,000 note characters. Initial cost currencies are EUR/USD/GBP with at most two decimal places and no exchange-rate service.

Owner/editor forms use the established dark interface, explicit Save, in-memory draft recovery and visible conflict/error states. Viewers see read-only values, notes and checklist completion. Attachments and durable Docs remain later increments.

The user requested a reusable local preview login; preserve that account, boards and user edits separately from disposable QA fixtures. Serve the Mac preview from a copied build release under ignored `.local/preview-releases` so later builds cannot replace its scripts. Verify project/process/port ownership before replacement; never stop a foreign service. This does not authorize LAN/public exposure or NAS deployment.

## 2026-10-06 — M2.6 search within authorized snapshots

For the initial small staff workspace, search/filter the existing session-verified `/api/work` snapshot in the browser. Do not add a search cluster, duplicate cache or unauthenticated endpoint. This preserves the server's current workspace boundary; integration tests apply the actual filter helper to verified owner/viewer/outsider snapshots and confirm membership removal denies subsequent reads. Larger datasets will need measured pagination/query work later.

Search literal case-insensitive title/notes text, capped at 200 characters. Combine status, one assignee/unassigned, priority and due-date scope with AND. Dates are before today/today/after today/no date using the local calendar day; completion is controlled separately by Status. Explicit Search/Apply writes URL parameters, Clear removes them, and result task links preserve them. Show eight task matches in Go to plus an all-results link; the full workspace result list is available from Boards → Find tasks. Draft filter input is not applied until submission.

## 2026-10-06 — M2.7 private task attachments

Adopt bounded raw streaming uploads to a dedicated private ATTACHMENT_ROOT, with PostgreSQL metadata and UUID storage names. Initial types are PDF, PNG/JPEG and UTF-8 TXT/Markdown/CSV, up to 25 MiB; owners/editors upload and shared staff members download. Files are forced downloads, with no inline rendering or format parsing/malware-scanning claim. Same-origin requests and fresh role/membership checks apply, including after transfer. Two upload slots per process and deadlines bound active work. Task changes and upload commits are separate; uncertain responses require refresh before retry. Uncertain database commits preserve bytes, accepting possible orphan storage rather than deleting a committed attachment. No dependency, migration, deletion UI, public/NAS deployment or full publication audit is included. See FILES.md and STATUS.md.

## 2026-10-06 — personal stellar identity prototype

User approved a literal star-like orb replacing the top-left logo/title and requested applicable design/UI skills. Prototype appearance first with an explicit slider, spatial colour transitions (0 red, 60 orange, 80 green, 100 brighter green), optional neutral state and pause control. At 75, target approximately 25% orange/75% green; texture makes the boundary organic. Do not imply these values measure real performance. The future score formula, time period and treatment of unplanned/overdue work remain undecided.

Use a small dependency-free client WebGL renderer with visibility/motion gating and a static fallback; no generated bitmap, server inference or extra service. Mobile's star retains the existing navigation-button action. Preview preferences are intentionally temporary, reset per refresh/account. This is an approved visual prototype, not finalized branding or a new M3 feature.

## 2026-10-06 — M3.1 shared views and calmer flares

User authorized progression into M3 and reduced stellar activity to one or two visible flares. Cap the shader at two loops with half-cycle staggering. Keep the star a preview, independent of task scoring.

Use built-in task status for Kanban and built-in due date for Calendar. Table retains board groups; neither alternate view changes group membership. Show undated tasks separately and count dates outside the selected month. Preserve view/month/filters in URLs. Reuse the existing task editor and Save flow for status/date changes instead of introducing a second mutation path or drag-only interaction. No live subscription until M3.2. M3.1 acceptance requires supported browser evidence; passing server/helper tests alone does not close it.

## 2026-10-06 — bounded automatic refresh and deferred browser checks

User explicitly deferred phone preview and instructed continuation into M3.2 after recording open checks. Preserve M3.1 and M3.2 browser gates in PENDING_CHECKS.md; implementation progress is not acceptance.

For the initial four-user workspace, use authorized full-snapshot polling every five seconds after completion in visible online tabs, with immediate reconnect/focus retry and bounded backoff. Reuse the existing transactional membership/session boundary; passive reads never refresh idle expiry. Avoid a broker or persistent connection service until scale requires it. Existing task revisions remain the edit-conflict authority; background updates must not overwrite drafts or clear save failures. Keep attachment lists, sample Docs and Team administration outside this polling claim. See LIVE_UPDATES.md.

## 2026-10-06 — M3.3 task activity and personal notifications

User instructed continuation with phone preview deferred. Task create/update actions write append-only activity and affected-assignee notifications atomically with the task transaction. Store actor name/time and bounded changed-field summaries, not historical note/checklist contents. Existing tasks begin history at their next change; no backfill. Suppress self notifications, no-op/retry/conflict duplicates and disabled/nonmember recipients. Pure position changes remain history without notifications. Removal from a task may notify the former assignee while they remain a workspace member. Workspace membership removal deletes their personal notifications through the membership boundary.

The notification bell uses the existing authorized snapshot poll. Notification/activity lists are explicit refreshable 25-item cursor pages; opening a task does not automatically mark a notification read. Read/unread is personal state available to every staff role, with server-side recipient scoping. Other workspace writes retain owner/editor requirements. Due reminders wait for M4.2; email, push, mentions and attachment history are not introduced. Browser denial leaves M3.3 acceptance open; no publication or phone listener was authorized or started.

## 2026-10-07 — Freeze visual design after random flares

User approved the integrated light/dark direction and requested two-to-four randomly enabled solar flares as the final visual adjustment for now. Keep subsequent work focused on functionality, verification and defect fixes within the existing design. This does not sign off pending browser/phone checks or connect the illustrative star to real task scoring.


## 2026-10-07 — External review assessment and corrective blocks

Authority: the user asked to assess `workspaceapp-review.md` as advice, not instructions, then to hash out blocks 1–3 and retain valid findings. This records the agreed direction and proposed details; it is not implementation evidence or adoption of the external roadmap. The user confirmed owner/editor task archive and owner-only board archive. Docs remains a drafted behavior proposal until the user configures the NAS; do not bring durable Docs forward now.

Standing principles:
- Preserve the approved Mineral/Midnight themes and stellar identity. Improve functional layout, density, navigation and editing within that direction. No unsolicited star redesign, task score formula or removal of user-requested Later items.
- Address saved-app interaction regressions and outstanding M3 acceptance before further feature expansion. Implementation and acceptance remain distinct; external test claims are supporting reports, not locally reproduced passes.
- Add repeatable browser regression tests alongside the existing database/behavior/HTTP checks. Retain scoped visual, keyboard and physical-phone checks. Never bypass a tool-policy denial.
- Preserve concurrency protection, drafts, workspace permissions and existing user data during quick-edit and archive work. Never silently overwrite or retry a conflicting mutation against a newer revision.
- Archive/restore is needed before routine team use. Editable session-only Docs must not look like a durable working feature. Deployment requires useful error logging, verified database/attachment recovery and the required security review.
- Keep the confirmed later features in scope. Comments, drag-and-drop, new scoring, automatic conflict merging and notification aggregation are not adopted by this review. The four-person cap is intentional; production resource use remains unmeasured.
- Keep current summaries concise and distinguish current evidence from dated history. Formatting is a separate behavior-preserving checkpoint; no backend rewrite solely because modules use JavaScript.

### Block 1 — Existing acceptance and repeatable verification

1. Map each M3.1–M3.3 gap to a browser scenario, existing lower-level test, visual inspection or actual-device check. Cover cross-view identity/dates/filters; four isolated account sessions; viewer writes denied; polling/reconnect and stale drafts; notification recipients/read state; expiry/revocation and console errors.
2. Build a committed browser-test harness against a disposable database, attachments directory, test accounts and separate local server. Never run destructive fixture setup against the saved preview or user boards. Test authentication uses fictional generated credentials; obey any browser credential restrictions.
3. Reproduce important journeys through supported automation, fix concrete failures and retain traces/screenshots on failure. Prepare repeatable local commands; CI integration must respect the no-spend constraint and not assume a paid runner allowance.
4. Format dense source separately, then rerun the appropriate existing checks. Do not combine formatting with feature behavior changes.

Done when: repeatable local browser scenarios pass, required existing checks pass, failures have fixes/retests, and PENDING_CHECKS accurately distinguishes covered journeys from remaining physical-device/environment checks. Do not claim total M3 acceptance while required checks remain open. New UI work in block 2 also requires regression checks against its final implementation.

### Block 2 — Board and task usability

1. Compress board heading/navigation/filter chrome, move infrequent configuration out of the primary work area, add readable table headings and omit repeated board names inside their own board. Aim for multiple useful tasks in the first desktop viewport and at least the start of task content on a normal phone viewport; exact pixel positions are not universal gates under zoom/long content.
2. Give the task editor a desktop side panel where space permits and a full-screen narrow layout. Keep Save/Cancel reachable with the software keyboard, prioritize title/status/priority/date/assignees then content, and put structure/order controls under secondary disclosure. Preserve unsaved-change handling, context, focus and Escape behavior.
3. Add quick status editing first in Table/Kanban; then due date, priority and assignees through the same revision-checked server path. Show pending/success/failure honestly; prevent dropped rapid edits and preserve a recoverable failed selection. Notes/checklists remain explicit-save drafts. No automatic conflicting-edit merge in this block.
4. Add textual overdue state for incomplete dated tasks across views, consistent app date formatting, and resolve verified active-tab/focus/spacing defects. Preserve native accessibility and useful task information; do not hide all non-high priorities or replace names with hover-only avatars by default.
5. Reduce repeated instructions and show clear sync state where polling applies. Keep refresh/retry for attachment, activity and notification lists until those lists actually refresh automatically; a polling bell is not evidence that its list is live.

Done when: routine status changes need no long editor/Save sequence, editor actions are reachable, tasks scan clearly, and desktop/narrow/keyboard/contrast/error/conflict checks pass without saved-data or role regressions. Physical keyboard/touch claims require a real phone check. Preserve the star's explicit prototype meaning; no new metric implied.

### Block 3 — Reversible archive and Docs boundary

Confirmed user choice: owners and editors may archive/restore tasks; only owners may archive/restore whole boards; viewers stay read-only. Enforce this on the server and test direct requests.

Proposed behavior: Archive removes work from active views/search/My Day without deleting its history or attachment bytes. A visible Archived list supports restoration beyond a short Undo window. Archiving a parent includes its active descendants with a disclosed count. Restoration must not revive descendants that were already archived separately. Board archive hides/freezes its contents; restoring the board preserves previously archived tasks. Archived records remain authorized/readable in the archive; edits and uploads are disabled until restoration. Preserve context for old activity/notification links. In-flight edits/uploads must fail safely if the target becomes archived. Record who archived/restored and when; revision checks apply. Independent attachment removal/purge is a separately designed follow-up, not physical file deletion hidden inside task archive.

User direction for Docs: draft the intended behavior and retain a note until NAS configuration is settled; no durable Docs implementation brought forward. Proposed interim boundary: normal authenticated Docs shows a clear “Document storage is not connected yet” explanation and no editable sample masquerading as saved work; preserve the writing prototype separately. Exact navigation/placeholder treatment remains a proposal, not a shipped change. Future durable Docs needs permissions, save/conflict handling, refresh/restart tests and recoverable drafts; simultaneous collaborative editing remains later. Do not replace the phone tab with a duplicate destination.

Done when: chosen permissions, archive/undo/restore, parent/board behavior, search/view exclusions, historical links, attachments and concurrent edits have database and browser evidence; Docs behavior matches the user's choice and cannot imply sample text is durably saved. No irreversible purge or deployment in these blocks.

## 2026-10-07 — Corrective behavior implemented

The user authorized implementation of the three scoped corrective blocks. Task archive/restore uses owner/editor permissions; whole-board archive/restore is owner-only. Active descendants share an archive batch; restoring it excludes previously independent archives. Board transitions invalidate existing revisions and keep historical records/files accessible to current authorized staff. There is no permanent purge.

Common table fields and Kanban status save immediately with serialized requests. Failed selections retain their original revision and remain recoverable in this tab; no retry silently rebases onto a teammate's changes. Details/forms remain explicit Save. The right-side/full-screen task panel keeps its actions outside scrolling content.

Accounts-mode Docs now shows a non-editable storage-pending explanation; the sample editor remains only in explicit prototype mode. Durable local Docs, permissions, save/recovery and collaboration remain later work after NAS configuration is settled. This does not choose NAS deployment or document retention.

Pinned formatting and isolated browser tooling support repeatable local checks. Fixture servers/databases/files and generated credentials stay under ignored .local paths. No hosted CI job or paid service has been enabled; local repeatability is the implemented boundary. See E2E_TESTING.md and PENDING_CHECKS.md for evidence and residual acceptance gaps.

## M3.4 dashboard counting rules — 2026-10-07

Implementation rules within the approved shared-staff dashboard scope: derive from the existing authorized snapshot rather than add another service or query path. Count each task/subtask equally, exclude archived work and Done from due buckets, and report rounded current Done/total completion without a reporting-period or hours/capacity claim. Personalized views remain shared work. Device-local calendar dates refresh at midnight/focus; no per-account timezone setting is introduced. Recent work uses saved task timestamps; notification counts remain recipient-private.

A multiple-assignee task counts once in team totals and once for each active assignee. Keep genuinely unassigned work separate from records whose assignees are all unavailable; expose a recovery list and explicit inactive-assignee removal without changing historical assignments automatically. Existing illustrative star/appearance settings remain independent of these metrics. No metric/scoring or private-workspace policy is implied.
