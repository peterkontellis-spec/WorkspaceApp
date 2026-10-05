# Current status

Updated: 2026-10-05 — M1.2–M1.5 implemented and pushed to GitHub; browser acceptance pending.

## Delivery state

The user authorised M1.2 through M1.5, with checkpoints, work confined to this project workspace, no credits/resets and no deployment. The existing dark/subtle design is preserved. Data is fictional and in memory: edits and drafts survive internal navigation, then reset on refresh/tab closure. No real authentication, database, uploads or collaborative editing exists.

| Increment | Implemented | Actual checks | Acceptance |
| --- | --- | --- | --- |
| M1.1 | Existing design specification | Prior planning review | Complete |
| M1.2 | Shell/navigation, search, sample accounts, field metadata, modal scroll containment | TypeScript/build; HTTP 13/13 | Browser pending |
| M1.3 | Personal overdue/today/upcoming/undated work, empty-state preview, recent Docs, shared state and task opening | Model 7/7; TypeScript/build; HTTP 14/14 | Browser pending |
| M1.4 | Grouped tasks, add/rename/date/status/priority/multiple assignees, URL-backed combined filters/collapsed groups | Model 7/7; TypeScript/build; HTTP 15/15 | Browser pending |
| M1.5 | Task notes/checklists/subtasks, sample file metadata, document linking, Markdown writing/formatting/safe preview and return context | Final model/Markdown/navigation 15/15; TypeScript/build; HTTP 16/16 | Browser pending |
| M1.6 and M2–M5 | Not implemented | — | Open |

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

## Final verification evidence

- `pnpm check`: TypeScript, **15 behavioural tests**, and production build passed.
- `pnpm check:smoke`: **16/16 HTTP checks** passed. These check redirects, page headings/disclosures, filtered server-rendered rows, task-notes/editor surfaces, contextual return-link markup and unknown-route status. They do not execute browser JavaScript.
- Model tests cover immutable edits, validation, date/assignment buckets, combined filters, independent group/status, add-task IDs, document identity/recency and reset. Markdown tests cover formatting, empty text, safe HTTP(S) links and inert raw HTML. Navigation tests cover safe return destinations and preserving filters while opening/closing tasks.
- Impeccable context loaded from the incumbent implementation/specification. Mechanical detector on components/CSS returned `[]`. Source reviewed with Impeccable, current Web Interface Guidelines and React best practices. No visual/accessibility score is claimed.
- Independent source review led to fixes for URL filter-control synchronization, focus fallback after edited tasks leave a list, recent-document ordering, and draft retention. Board rename/date/new-task and task checklist/subtask input now live in shared session drafts.
- `git diff --check` passed before checkpointing. No new runtime dependency was added.
- Latest usage check: **89% of the reported weekly allowance remained**, ordinary usage allowed. No credits, purchases or resets used.

## Browser blocker and outstanding checks

Supported browser access again refused the local URL because the admin-enforced policy could not be verified. No screenshots, desktop/phone render checks, clicks, focus checks or software-keyboard checks succeeded. No alternative browser/renderer was used to bypass the restriction.

Run RUNNING.md's full checklist once supported browser access is restored. Prioritise task/dialog focus (including a task disappearing from its filtered list), Home → board/task → Doc return with scroll/filter retention, formatting selection, draft retention, clear/reset controls, responsive overflow and unknown-route recovery.

## Next action

Restore supported browser access and finish M1.2–M1.5 acceptance. GitHub authentication and checkpoint upload are complete. Fix findings before marking increments complete or starting M1.6. No further product scope is authorised by this status record.
