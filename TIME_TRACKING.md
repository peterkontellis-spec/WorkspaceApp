# Saved time tracking

M3.5 adds `/time` and a task-panel link. The navigation item is active only in accounts mode. This is shared staff time history, not billing, payroll or a private productivity score.

## Access and persistence

- All active staff can read completed entries and totals in their workspace. Owners and editors create and change only their own entries. Viewers are read-only; owners have no override for another person's entries.
- One running timer per person across all tabs/devices/workspaces is enforced by the database. Its global indicator joins the existing work snapshot; the Time page refreshes while visible and online. A running timer does not change task status.
- Elapsed time uses stored server timestamps, truncated to seconds. Closing the browser or restarting the app/database does not stop it. The ticking display is an estimate anchored to the last server response, not the source of saved totals.
- Archiving its task/board, removing workspace membership, downgrading to viewer or disabling the account closes a running timer in the same database transaction. The reason and elapsed history remain. Restoring access/work does not restart it.
- All changes require current membership and server-side ownership. Task revisions protect timer/manual creation against stale work. Entry revisions protect corrections and void/restore. Repeated starts, manual creations and stops use stable identifiers to avoid duplicate entries. A manual creation retried with different values or after a subsequent correction returns a conflict.

## Recording and correction

Manual input accepts a work date, duration from one second to 24 hours, and an optional note up to 2,000 characters. A completed timer can be corrected using the same fields. The correction assigns its adjusted duration to the chosen date; original timer timestamps remain visible. Changes retain before/after audit rows in the database.

“Void entry” requests inline confirmation and excludes the entry from totals; “Restore entry” includes it again. Neither deletes history. Archived work's entries remain readable, with mutation controls unavailable until the task and board are restored. Instantly stopped timers may legitimately contain zero seconds; a manually entered correction must contain at least one second.

Unfinished form input is kept in the current tab during internal navigation, with the existing unsaved-input unload warning. It is not offline storage and does not survive all reloads/browser closures. Failed/uncertain saves retain the form. Automatic reads cannot dismiss uncertain-save warnings. Reconnect, inspect the records, then retry the unchanged entry or explicitly discard/reopen its latest version; conflict handling never silently overwrites another save.

## Dates and totals

The default range is the first day of the viewer's current month through today, using the browser's local IANA timezone. Filters are in the URL; a range may span up to 93 inclusive days. Task links scope this default range, not all historical time. Choose earlier dates to see older work.

- By-task, by-board and by-date totals include all staff and archived work, excluding running and voided entries.
- Original timers split at actual local midnight, including 23/25-hour daylight-saving days. Only the portion inside the date range counts.
- Manual entries and corrected timers belong entirely to the selected work date.
- Entry rows show the full duration even when the selected range includes only part of a timer. This distinction is stated on the page.
- History is paginated at 50 entries; totals cover the entire filtered range, not just the visible page. Voided entries remain in history so their owner can restore them.

No new service, package, external integration or NAS exposure is added. Migration `008_time_tracking.sql` adds the entries, audit records, constraints, indexes and lifecycle triggers. Existing work is not backfilled into fictional time. Actual checks and remaining device acceptance are recorded in STATUS.md and PENDING_CHECKS.md.
