# Current status

Updated: 2026-10-05 — M1.6 review in progress; browser crash diagnosed and refinements implemented; final browser verification blocked.

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

## Next action

Restore supported browser access, then confirm the new calendar (mouse + keyboard, Save/Cancel/clear), mobile Write/Preview from a scrolled editor, nested link rendering, and Assistant · Later on desktop/mobile. Finish the remaining RUNNING.md checks: account changes, Back/Forward and collapsed/filter/scroll retention, subtask completion, reset confirmation/cancellation, refresh warning, 404 recovery, 390px and medium-width coverage. M1.6 and Stage 1 stay open until that evidence exists; M2 has not started.
