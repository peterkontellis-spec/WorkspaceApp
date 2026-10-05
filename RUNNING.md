# Run the workspace prototype

## Current scope

M1.2 implements the application shell: sidebar/top bar, responsive phone navigation, Home/Boards/Docs routes, a page/project/document picker, and sample-account switching. The Home and board task rows are read-only preview content. The document page identifies the future editor location.

Use [STATUS.md](STATUS.md) for actual verification results. Browser interaction and visual QA remain pending because the browser tool could not verify its admin-enforced security policy. Successful compilation does not establish that these browser checks pass.

No database, real accounts, permissions, uploads, document saving, or NAS deployment is implemented. Sample-account selection lives in memory and resets on refresh. The sample date is fixed at 25 September 2026.

## Open the current preview

While the local development server is running, open:

[Workspace preview](http://127.0.0.1:3100/home)

The server binds to this Mac's loopback interface. This link is for this Mac; it is not an externally hosted address or a phone-accessible NAS deployment.

## Start it again

Requirements: Node.js 20.9 or later (tested here with the bundled Node 24.19.0) and pnpm 11.25.0. The project lockfile records the installed dependency versions.

From a terminal:

```sh
cd /Users/peterkontellis/.codex/.chatgpt-projects/g-p-6a0f76716e988191962260a53dc7ed97/workspace-app
pnpm install --frozen-lockfile
pnpm dev
```

Installation is only necessary when dependencies are missing or changed. The development command serves port 3100 on `127.0.0.1`. Keep the terminal running; Ctrl+C stops the preview. If this project's server is already running, reuse it rather than starting another copy. A port collision should be resolved explicitly, not by silently choosing an unrelated service.

### This Mac's bundled runtime

Node is bundled with Codex but was not on the terminal's default PATH during setup. If `node` cannot be found here, run this before the commands above:

```sh
export PATH="/Users/peterkontellis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/peterkontellis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
```

This line is specific to this Mac. Other computers should use their normal Node and pnpm installations.

## Check the project

```sh
pnpm typecheck
pnpm build
```

Both commands passed during M1.2. A native framework standalone build is configured to prepare for eventual self-hosting. NAS packaging, static-asset copying, service configuration, backups, and deployment are still M5 work; `.next/standalone` by itself is not a complete deployed product.

### Repeatable self-check commands

Run `pnpm check` for the typecheck and production build. With this project's server running at `127.0.0.1:3100`, run `pnpm check:smoke` in another terminal. The smoke script checks the Home redirect, all eight current sample pages, prototype disclosure, and HTTP 404 status for four unknown routes. Recovery-link rendering and clicks remain browser checks. The script exits nonzero on failure and uses no additional dependencies.

These HTTP checks do not execute client JavaScript, click controls, inspect layout, or replace the browser checklist below. Do not use them as a workaround for a denied browser check. Extend the checks as routes and behavior evolve.

Every task/session follows the required self-check loop in AGENTS.md: implement, inspect, run/test, review with design/UI skills, fix, confirm, reassess the next action, and record evidence. No daily or unattended automation is configured.

Next.js automatic agent-instruction generation is disabled in next.config.ts so development does not append generated guidance to the existing project AGENTS.md.

## Browser checks to finish M1.2

Run these once browser inspection is available, recording actual results in STATUS.md:

- [ ] Visit Home, Boards, and Docs; verify the current section, direct refresh, and browser Back/Forward.
- [ ] Open both sample boards and each sample document, then return to their lists.
- [ ] Search with the Go to control and Cmd/Ctrl+K; check matches, no matches, clearing the query, and destination navigation.
- [ ] Switch sample accounts; verify the heading/sample task list changes, navigation retains the selection, and refresh resets it.
- [ ] Open account/navigation dialogs, then press Cmd/Ctrl+K: search should remain open after the previous dialog closes.
- [ ] Use Tab/Shift+Tab, Enter, and Escape; verify visible focus, dialog focus containment, and focus return.
- [ ] Inspect 360 px, 390 px, medium desktop, and wide desktop; verify legible content, larger controls, no page-wide overflow, and no content hidden by bottom navigation.
- [ ] Verify future sections are labelled Later and tasks/editor do not suggest real saving or authentication.
- [ ] Check unknown board/document URLs show the not-found page with a route back Home.

No phone hardware or phone software-keyboard behavior has been tested. The M1.2 shell has no document-writing surface yet.

## Source guide

| Location | Responsibility |
| --- | --- |
| `src/app/layout.tsx` | Shared document metadata and application shell |
| `src/app/[...segments]/page.tsx` | Validate and serve sample section/detail routes |
| `src/components/workspace-shell.tsx` | Navigation, page picker, sample account, and mobile menu |
| `src/components/workspace-pages.tsx` | Sample Home, board list/previews, and Docs navigation |
| `src/components/ui.tsx` | Buttons, fields, panels, task rows, status labels, avatars, and dialogs |
| `src/lib/demo.ts` | Four fictional members, two boards, three Docs, and twelve linked sample tasks |
| `src/app/globals.css` | Shared dark theme, larger controls, and responsive layouts |

Keep one set of sample records shared across screens. Later increments can extend these components without treating the current read-only content as completed task-management features.
