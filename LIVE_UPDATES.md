# Automatic board updates — M3.2

The initial four-person workspace uses authorized snapshot refreshes approximately every five seconds while a tab is visible and online. This is polling, not an instant push channel. Delivery time includes the interval and request latency. No extra server, broker or database migration is introduced.

Each read uses the existing session/membership-checked `/api/work` transaction. Reads do not extend the session's idle timeout. A reconnect fetches the current full authorized snapshot, so intermediate missed events do not need replay. This covers boards, groups, columns, task values and the snapshot's member roster. It is not a live feed for attachments, the Team administration screen or sample Docs.

Requirements for this increment:

- Serialize reads and avoid overlapping polls. Abort or invalidate old reads when saving, manually reloading or unmounting; an old response must not replace newer saved data.
- Pause while hidden/offline, retry immediately when visible/focused/online, and back off after transient errors rather than retrying rapidly.
- Keep current data during a transient connection problem but clearly indicate it may be stale. Retry automatically and offer an explicit retry.
- Preserve task/form drafts and their opening revisions. Background success must not clear an unrelated save error or conflict. If an open task has changed, explain that a newer version exists and use the existing deliberate reload/discard flow.
- Expired/revoked sessions stop refreshing and clear cached saved records/drafts. A different signed-in identity must not be applied to the old account's UI.
- Owners/editors continue to use revision-checked writes; viewers remain read-only.

Four open tabs imply approximately 48 reads/minute before activity checks, with more requests possible for focus/retry/manual actions. Payload cost grows with the workspace snapshot, so large-workspace and NAS CPU/RAM/battery suitability remain to be measured. Background mobile tabs are paused; this is not mobile push or offline editing.

See STATUS.md for actual implementation/tests and PENDING_CHECKS.md for the outstanding browser acceptance. Automated controller/database evidence does not prove browser reconnect, draft focus or layout behaviour.
