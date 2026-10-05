# Current status

Updated: 2026-10-06 — key browser checks passed; reset confirmation moved in-page; explicit local-site approval verified; browser access restored.

## Delivery state

The user authorised M1.2 through M1.6, with checkpoints, work confined to this project workspace, no credits/resets and no deployment. The existing dark/subtle design is preserved. Data is fictional and in memory: edits and drafts survive internal navigation, then reset on refresh/tab closure. No real authentication, database, uploads or collaborative editing exists.

| Increment | Implemented | Actual checks | Acceptance |
| --- | --- | --- | --- |
| M1.1 | Existing design specification | Prior planning review | Complete |
| M1.2 | Shell/navigation, search, sample accounts, field metadata, modal scroll containment | TypeScript/build; HTTP 13/13 | Browser pending |
| M1.3 | Personal overdue/today/upcoming/undated work, empty-state preview, recent Docs, shared state and task opening | Model 7/7; TypeScript/build; HTTP 14/14 | Browser pending |
| M1.4 | Grouped tasks, add/rename/date/status/priority/multiple assignees, URL-backed combined filters/collapsed groups | Model 7/7; TypeScript/build; HTTP 15/15 | Browser pending |
| M1.5 | Task notes/checklists/subtasks, sample file metadata, document linking, Markdown writing/formatting/safe preview and return context | Final model/Markdown/navigation 15/15; TypeScript/build; HTTP 16/16 | Browser pending |
| M1.6 | Direct browser review, in-page calendar replacement, Docs preview refinements, Assistant · Later navigation | See current review below | Final browser confirmation pending |
| M2–M5 | Not implemented | — | Open |

All M1.2–M1.5 completion boxes stay open until their browser acceptance checks pass. The latest explicit handoff permits implementation while browser access is blocked; it does not turn pending checks into passes.

## Preview

Local development server was running and responding at **http://127.0.0.1:3100/home** after the final HTTP checks. Server lifetime is session-dependent; see RUNNING.md to restart. It is bound to this Mac's loopback address, not publicly exposed or deployed to the NAS.

Try Home → a task → linked Launch brief → edit text → Preview → Back to task → Close. Boards support editing/filtering. The sample account dialog includes Reset demo with confirmation. A refresh/close warning is registered after session changes; its actual browser behavior is still unverified.

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

## Next action

With supported browser access restored, finish the remaining checks listed in the October 6 review, beginning with refresh/close warning behavior and the full task/Docs return-context matrix. Do not repeat the already-confirmed calendar and preview checks without a relevant change. M1.6 and Stage 1 remain open; M2 has not started.
