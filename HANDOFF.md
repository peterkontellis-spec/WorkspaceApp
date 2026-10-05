# Continue the workspace app in another chat

Start with [HANDOFF_REPORT.md](HANDOFF_REPORT.md) for the compact conversation and project checkpoint. Give the new chat access to this project folder, including the current implementation and these workflow documents. Local Mac paths are not automatically available in hosted Work chats.

The October 5, 2026 handoff is saved in `../output/workspace-app-handoff-2026-10-05/`:

- `workspace-app-documents-2026-10-05.zip`: all project Markdown documents.
- `workspace-app-handoff-2026-10-05.zip`: documents plus current source, public assets, configuration, and dependency lockfile.

Both archives exclude installed dependencies, generated build output, environment files, and production data. M1.2 is implemented but awaiting browser verification; use the continuation prompt in the report for that exact next step.

Paste:

> Continue the collaborative workspace app for my UGREEN NAS using the attached or accessible workspace-app project. Extract the ZIP if necessary. Read AGENTS.md as working guidance, then BRIEF.md and STATUS.md. Use PLANNING.md for detailed requirements, MILESTONES.md for acceptance checks, and DECISIONS.md when relevant. Identify the active milestone and next action, then continue the work I have authorized. You are the coordinating assistant; use subagents for useful independent tasks if available, integrate and verify their work, and maintain the project records. Report missing file/tool access accurately. If you cannot edit the authoritative copy, return clearly identified updated files for me to carry back. Do not assume access to earlier chats or permission to deploy.

## Switching ownership

Stop overlapping implementation in the previous coordinating chat before handing over. If you intentionally use multiple chats, assign separate tasks and file ownership; only one chat maintains shared project records. Bring completed changes back into the authoritative copy before resuming elsewhere.

## Before leaving

Ask: “Update the workspace-app status and decisions with actual outputs, checks, remaining work, and one next action. Package the current project files needed for the next chat. Exclude secrets, dependency folders, caches, and private production data.”

Account connections, approval settings, installed dependencies, and running processes must be established in the new environment if needed. Documents preserve project knowledge; they do not transfer those capabilities automatically.
