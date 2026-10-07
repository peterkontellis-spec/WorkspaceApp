'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWork } from './work-provider';
import { useWorkDay } from './use-work-day';
import { useTimeReport } from './use-time-report';
import { TimerElapsed } from './active-time';
import { DatePicker } from './date-picker';
import { Button } from './ui';
import { durationLabel, type TimeEntry } from '@/lib/time';
import { workDate, type WorkSnapshot } from '@/lib/work';
import { localDateKey } from '@/lib/work-dashboard.mjs';
import './saved-work.css';
import './saved-time.css';

type Draft = {
  entry: TimeEntry | null;
  taskId: string;
  workDate: string;
  hours: string;
  minutes: string;
  seconds: string;
  notes: string;
  creationId: string;
  taskRevision: number | null;
};
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const displayDate = (s: string) => (validDate(s) ? workDate(s) : 'Invalid date');
const reasons: Record<string, string> = {
  task_archived: 'Stopped when the task was archived.',
  board_archived: 'Stopped when the board was archived.',
  membership_removed: 'Stopped when workspace access was removed.',
  read_only: 'Stopped when editing access ended.',
  account_disabled: 'Stopped when the account was disabled.',
};
const stamp = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
function newDraft(taskId: string, today: string, data: WorkSnapshot): Draft {
  return {
    entry: null,
    taskId,
    taskRevision: data.tasks.find((t) => t.id === taskId)?.revision ?? null,
    workDate: today,
    hours: '0',
    minutes: '30',
    seconds: '0',
    notes: '',
    creationId: crypto.randomUUID(),
  };
}
export function SavedTimePage() {
  const { data, error, refresh } = useWork();
  const today = useWorkDay();
  const params = useSearchParams();
  const [zone, setZone] = useState('');
  useEffect(() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  if (!data || !today || !zone)
    return (
      <section>
        <h1>Time</h1>
        <p role={error ? 'alert' : 'status'}>{error || 'Loading saved work…'}</p>
        {error && <Button onClick={() => void refresh()}>Retry</Button>}
      </section>
    );
  const from = params.get('from') || `${today.slice(0, 7)}-01`,
    to = params.get('to') || today,
    taskId = params.get('taskId') || '',
    cursor = params.get('cursor') || '';
  const query = new URLSearchParams({ from, to, timeZone: zone });
  if (taskId) query.set('taskId', taskId);
  if (cursor) query.set('cursor', cursor);
  return (
    <TimeContent
      key={`${data.actor.id}:${query}`}
      data={data}
      today={today}
      zone={zone}
      from={from}
      to={to}
      taskId={taskId}
      cursor={cursor}
      query={query.toString()}
    />
  );
}

function TimeContent({
  data,
  today,
  zone,
  from,
  to,
  taskId,
  cursor,
  query,
}: {
  data: WorkSnapshot;
  today: string;
  zone: string;
  from: string;
  to: string;
  taskId: string;
  cursor: string;
  query: string;
}) {
  const work = useWork();
  const router = useRouter();
  const params = useSearchParams();
  const time = useTimeReport(query, data.actor.id);
  const [range, setRange] = useState({
    from: validDate(from) ? from : today,
    to: validDate(to) ? to : today,
    taskId,
  });
  const [rangeError, setRangeError] = useState('');
  const [timerTask, setTimerTask] = useState(taskId && data.tasks.some((t) => t.id === taskId) ? taskId : '');
  const startId = useRef(crypto.randomUUID());
  const [draft, setDraft] = useState<Draft>(
    () => (work.drafts['time:form'] as Draft | undefined) ?? newDraft(timerTask, today, data),
  );
  const [localError, setLocalError] = useState('');
  const [confirmation, setConfirmation] = useState<TimeEntry | null>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const canEdit = data.actor.role !== 'viewer' && time.state !== 'expired';
  const report = time.report;
  const allTasks = [...data.tasks, ...data.archivedTasks];
  const error = time.error || localError;
  useEffect(() => {
    if (error) feedback.current?.focus();
  }, [error]);
  function patch(values: Partial<Draft>) {
    const next = { ...draft, ...values };
    setDraft(next);
    work.setDraft('time:form', next);
    setLocalError('');
  }
  function clearDraft() {
    setDraft(newDraft(timerTask, today, data));
    work.setDraft('time:form', null);
    setLocalError('');
  }
  function applyRange(event: FormEvent) {
    event.preventDefault();
    const valid = (s: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
      new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86400000;
    if (!valid(range.from) || !valid(range.to) || days < 0 || days > 92) {
      setRangeError('Choose a valid date range of up to 93 days.');
      return;
    }
    const next = new URLSearchParams({ from: range.from, to: range.to });
    if (range.taskId) next.set('taskId', range.taskId);
    router.push(`/time?${next}`);
  }
  function page(nextCursor: string | null) {
    const next = new URLSearchParams(params);
    if (nextCursor) next.set('cursor', nextCursor);
    else next.delete('cursor');
    router.push(`/time?${next}`, { scroll: false });
  }
  async function start() {
    const task = data.tasks.find((t) => t.id === timerTask);
    if (!task) {
      setLocalError('Choose an active task for your timer.');
      return;
    }
    if (
      await time.mutate({
        action: 'start',
        creationId: startId.current,
        taskId: task.id,
        taskRevision: task.revision,
      })
    )
      startId.current = crypto.randomUUID();
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const parts = [draft.hours, draft.minutes, draft.seconds];
    if (parts.some((v) => !/^\d+$/.test(v)) || Number(draft.minutes) > 59 || Number(draft.seconds) > 59) {
      setLocalError('Enter whole hours, minutes and seconds. Minutes and seconds must be between 0 and 59.');
      return;
    }
    const durationSeconds = Number(draft.hours) * 3600 + Number(draft.minutes) * 60 + Number(draft.seconds);
    if (durationSeconds < 1 || durationSeconds > 86400) {
      setLocalError('Enter a duration from 1 second to 24 hours.');
      return;
    }
    if (!draft.workDate) {
      setLocalError('Choose a work date.');
      return;
    }
    work.setDraft('time:form', draft);
    const values = { workDate: draft.workDate, durationSeconds, notes: draft.notes };
    const entry = await time.mutate(
      draft.entry
        ? { action: 'update', id: draft.entry.id, revision: draft.entry.revision, patch: values }
        : {
            action: 'add',
            creationId: draft.creationId,
            taskId: draft.taskId,
            taskRevision: draft.taskRevision,
            ...values,
          },
    );
    if (entry) clearDraft();
  }
  function edit(entry: TimeEntry) {
    const duration = entry.durationSeconds ?? 0;
    const next: Draft = {
      entry,
      taskId: entry.taskId,
      taskRevision: null,
      workDate: entry.workDate || (entry.startedAt ? localDateKey(new Date(entry.startedAt)) : today),
      hours: String(Math.floor(duration / 3600)),
      minutes: String(Math.floor((duration % 3600) / 60)),
      seconds: String(duration % 60),
      notes: entry.notes,
      creationId: crypto.randomUUID(),
    };
    setDraft(next);
    work.setDraft('time:form', next);
    setLocalError('');
    requestAnimationFrame(() => {
      editHeading.current?.scrollIntoView({ block: 'center' });
      editHeading.current?.focus({ preventScroll: true });
    });
  }
  const hasDraft = Boolean(work.drafts['time:form']);
  const active = report?.activeTimer;
  return (
    <section className="saved-work time-page">
      <div className="page-heading">
        <div>
          <h1>Time</h1>
          <p className="page-description">
            Shared records. Everyone can read them; editors and owners change only their own time.
          </p>
        </div>
        <Button disabled={time.pending} onClick={() => void time.refresh()}>
          Refresh time
        </Button>
      </div>
      {error && (
        <p role="alert" tabIndex={-1} ref={feedback} className="auth-error">
          {error}
        </p>
      )}
      {time.notice && (
        <p role="status" className="saved-notice">
          {time.notice}
        </p>
      )}
      {time.state === 'offline' && (
        <p role="status" className="saved-scope">
          Offline or unable to connect. Displayed time may be out of date; a running timer continues on the
          server.
        </p>
      )}
      {time.state === 'expired' && (
        <p>
          <Link className="text-link" href="/sign-in">
            Sign in again
          </Link>
        </p>
      )}
      <section className="time-section" aria-labelledby="timer-heading">
        <h2 id="timer-heading">Your timer</h2>
        {!report ? (
          <p role="status">
            {time.error ? 'Time is unavailable until the connection returns.' : 'Loading your timer…'}
          </p>
        ) : active ? (
          <div className="time-running">
            <div>
              <Link className="text-link" href={`/boards/${active.boardId}?task=${active.taskId}`}>
                {active.taskTitle}
              </Link>
              <p>
                <TimerElapsed entry={active} serverNow={report.serverNow} />
              </p>
              <small>
                Started {stamp(active.startedAt!)}. This timer continues when you close the browser.
              </small>
            </div>
            {canEdit && (
              <Button
                variant="primary"
                disabled={time.pending}
                onClick={() => void time.mutate({ action: 'stop', id: active.id, revision: active.revision })}
              >
                Stop timer
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="page-description">
              No timer running. One timer per person across all tabs and devices.
            </p>
            {canEdit && (
              <div className="time-start">
                <label>
                  Timer task
                  <select
                    value={timerTask}
                    onChange={(e) => {
                      setTimerTask(e.target.value);
                      startId.current = crypto.randomUUID();
                    }}
                    disabled={time.pending}
                  >
                    <option value="">Choose an active task</option>
                    {data.tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {data.boards.find((b) => b.id === task.boardId)?.name} · {task.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="primary" disabled={time.pending} onClick={() => void start()}>
                  Start timer
                </Button>
              </div>
            )}
          </>
        )}
      </section>
      <section className="time-section" aria-labelledby="time-records-heading">
        <h2 id="time-records-heading">Recorded time</h2>
        <form className="time-filters" onSubmit={applyRange}>
          <DatePicker
            label="From date"
            value={range.from}
            baseDate={today}
            onChange={(from) => setRange({ ...range, from })}
          />
          <DatePicker
            label="To date"
            value={range.to}
            baseDate={today}
            onChange={(to) => setRange({ ...range, to })}
          />
          <label>
            Task filter
            <select value={range.taskId} onChange={(e) => setRange({ ...range, taskId: e.target.value })}>
              <option value="">All tasks</option>
              {allTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                  {task.archivedAt ? ' · Archived' : ''}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Apply dates and task</Button>
        </form>
        {rangeError && (
          <p role="alert" className="auth-error">
            {rangeError}
          </p>
        )}
        <p className="time-hint">
          {displayDate(from)}–{displayDate(to)} · {zone}. Summaries include completed time from all staff,
          including archived tasks. Running timers and voided entries are excluded.
        </p>
        {report && (
          <>
            <p className="time-total">
              Recorded total <strong>{durationLabel(report.summary.totalSeconds)}</strong>
            </p>
            <div className="time-summaries">
              <section aria-label="Time by board">
                <h3>By board</h3>
                {report.summary.byBoard.length ? (
                  <ul>
                    {report.summary.byBoard.map((row) => (
                      <li key={row.boardId}>
                        <Link href={`/boards/${row.boardId}`}>{row.name}</Link>
                        <span>{durationLabel(row.seconds)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No recorded time.</p>
                )}
              </section>
              <section aria-label="Time by date">
                <h3>By date</h3>
                {report.summary.byDate.length ? (
                  <ul>
                    {report.summary.byDate.map((row) => (
                      <li key={row.date}>
                        <span>{workDate(row.date)}</span>
                        <span>{durationLabel(row.seconds)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No recorded time.</p>
                )}
              </section>
            </div>
            <details className="time-task-totals">
              <summary>Totals by task</summary>
              <ul>
                {report.summary.byTask.map((row) => (
                  <li key={row.taskId}>
                    <Link className="text-link" href={`/boards/${row.boardId}?task=${row.taskId}`}>
                      {row.title}
                    </Link>
                    <span>{durationLabel(row.seconds)}</span>
                  </li>
                ))}
              </ul>
            </details>
            <h3>Entries</h3>
            {!report.entries.length ? (
              <p className="page-description">
                No time entries in this range. Choose different dates or add an entry.
              </p>
            ) : (
              <ul className="time-entries">
                {report.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className={entry.voidedAt ? 'time-entry time-entry--void' : 'time-entry'}
                  >
                    <div>
                      <Link className="text-link" href={`/boards/${entry.boardId}?task=${entry.taskId}`}>
                        {entry.taskTitle}
                      </Link>
                      <p>
                        {entry.userName} ·{' '}
                        {entry.kind === 'manual' ? 'Manual' : entry.adjusted ? 'Adjusted timer' : 'Timer'}
                        {entry.voidedAt ? ' · Voided' : ''}
                      </p>
                      <p>
                        {entry.workDate
                          ? workDate(entry.workDate)
                          : `${stamp(entry.startedAt!)} → ${stamp(entry.endedAt!)}`}
                      </p>
                      {entry.notes && <p className="time-entry-notes">{entry.notes}</p>}
                      {entry.stopReason && (
                        <p>{reasons[entry.stopReason] || 'Timer stopped automatically.'}</p>
                      )}
                      {entry.adjusted && (
                        <small>
                          Original timer: {durationLabel(entry.originalSeconds ?? 0)} ·{' '}
                          {stamp(entry.startedAt!)} → {stamp(entry.endedAt!)}
                        </small>
                      )}
                    </div>
                    <div className="time-entry-actions">
                      <strong>{durationLabel(entry.durationSeconds ?? 0)}</strong>
                      {allTasks.find((t) => t.id === entry.taskId)?.archivedAt && (
                        <span>Archived task · restore its work before changing time.</span>
                      )}
                      {canEdit &&
                        entry.userId === data.actor.id &&
                        !allTasks.find((t) => t.id === entry.taskId)?.archivedAt && (
                          <>
                            {!entry.voidedAt && (
                              <Button
                                disabled={
                                  time.pending ||
                                  hasDraft ||
                                  Boolean(allTasks.find((t) => t.id === entry.taskId)?.archivedAt)
                                }
                                onClick={() => edit(entry)}
                              >
                                Edit entry
                              </Button>
                            )}
                            {entry.voidedAt ? (
                              <Button
                                disabled={time.pending}
                                onClick={() =>
                                  void time.mutate({
                                    action: 'restore',
                                    id: entry.id,
                                    revision: entry.revision,
                                  })
                                }
                              >
                                Restore entry
                              </Button>
                            ) : confirmation?.id === entry.id ? (
                              <>
                                <span>Exclude this entry from totals? It stays available to restore.</span>
                                <Button
                                  disabled={time.pending}
                                  onClick={async () => {
                                    if (
                                      await time.mutate({
                                        action: 'void',
                                        id: entry.id,
                                        revision: confirmation.revision,
                                      })
                                    )
                                      setConfirmation(null);
                                  }}
                                >
                                  Confirm void
                                </Button>
                                <Button disabled={time.pending} onClick={() => setConfirmation(null)}>
                                  Keep entry
                                </Button>
                              </>
                            ) : (
                              <Button disabled={time.pending} onClick={() => setConfirmation(entry)}>
                                Void entry
                              </Button>
                            )}
                          </>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="saved-actions">
              {cursor && (
                <Button disabled={time.pending} onClick={() => page(null)}>
                  Latest entries
                </Button>
              )}
              {report.nextCursor && (
                <Button disabled={time.pending} onClick={() => page(report.nextCursor)}>
                  Older entries
                </Button>
              )}
            </div>
            <p className="time-hint">
              Entry durations show their full recorded length. Date summaries split unadjusted timers at
              midnight; a range may include only part of an entry. Manual entries and corrections belong to
              the chosen work date.
            </p>
          </>
        )}
      </section>
      {canEdit && (
        <section className="time-section" aria-labelledby="time-entry-heading">
          <h2 id="time-entry-heading" tabIndex={-1} ref={editHeading}>
            {draft.entry ? 'Correct your entry' : 'Add manual time'}
          </h2>
          {draft.entry?.kind === 'timer' && (
            <p className="time-hint">
              This correction records the stated duration on your chosen work date. The original timer
              timestamps are retained.
            </p>
          )}
          {hasDraft && (
            <p className="time-hint">
              Unsaved time input is kept in this tab. Finish or discard it before editing another entry. If
              another device changed this entry, discard this draft and reopen the latest entry. For a changed
              task, reselect the task before saving new time.
            </p>
          )}
          <form className="time-form" onSubmit={save}>
            {draft.entry ? (
              <p>{draft.entry.taskTitle}</p>
            ) : (
              <label>
                Entry task
                <select
                  required
                  disabled={time.pending}
                  value={draft.taskId}
                  onChange={(e) =>
                    patch({
                      taskId: e.target.value,
                      taskRevision: data.tasks.find((t) => t.id === e.target.value)?.revision ?? null,
                    })
                  }
                >
                  <option value="">Choose an active task</option>
                  {data.tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {data.boards.find((b) => b.id === task.boardId)?.name} · {task.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <fieldset disabled={time.pending}>
              <legend>Entry details</legend>
              <DatePicker
                label="Work date"
                value={draft.workDate}
                baseDate={today}
                onChange={(workDate) => patch({ workDate })}
              />
              <div className="time-duration-fields">
                {(['hours', 'minutes', 'seconds'] as const).map((field) => (
                  <label key={field}>
                    {field[0].toUpperCase() + field.slice(1)}
                    <input
                      name={field}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max={field === 'hours' ? 24 : 59}
                      step="1"
                      required
                      value={draft[field]}
                      onChange={(e) => patch({ [field]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <label>
                Time note
                <textarea
                  name="time-note"
                  maxLength={2000}
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
            </fieldset>
            <div className="saved-actions">
              <Button type="submit" variant="primary" disabled={time.pending}>
                {time.pending ? 'Saving…' : draft.entry ? 'Save correction' : 'Save time entry'}
              </Button>
              {hasDraft && (
                <Button disabled={time.pending} onClick={clearDraft}>
                  Discard time input
                </Button>
              )}
            </div>
          </form>
        </section>
      )}
    </section>
  );
}
