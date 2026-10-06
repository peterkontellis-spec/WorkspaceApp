'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { WorkGroup, WorkMember, WorkTask } from '@/lib/work';
import { localToday } from '@/lib/work';
import { AssigneePicker } from './assignee-picker';
import { DatePicker } from './date-picker';
import { Button, StatusLabel } from './ui';
import { useWork } from './work-provider';
import './saved-task-editor.css';

type Draft = Pick<WorkTask, 'title' | 'status' | 'priority' | 'groupId' | 'parentId' | 'dueDate' | 'assigneeIds'> & { position: string };
type CachedDraft = { initial: { draft: Draft; revision: number }; draft: Draft };

export type SavedTaskEditorProps = {
  task: WorkTask;
  groups: WorkGroup[];
  tasks: WorkTask[];
  members: WorkMember[];
  canEdit: boolean;
  save: (payload: object) => Promise<boolean>;
  pending: boolean;
  error: string;
  close: () => void;
  saved: () => void;
  reload: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

function taskDraft(task: WorkTask): Draft {
  return { title: task.title, status: task.status, priority: task.priority, groupId: task.groupId,
    parentId: task.parentId, dueDate: task.dueDate, position: String(task.position), assigneeIds: [...task.assigneeIds] };
}

function draftKey(draft: Draft) {
  return JSON.stringify({ ...draft, assigneeIds: [...draft.assigneeIds].sort() });
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

export function SavedTaskEditor({ task, groups, tasks, members, canEdit, save, pending, error, close, saved, reload, onDirtyChange }: SavedTaskEditorProps) {
  const work = useWork();
  const cacheKey = `task:${task.id}`;
  // A refreshed roster or board must not silently overwrite a draft or advance its revision.
  // The layout provider also keeps these values when browser history unmounts the panel.
  const [opening] = useState<CachedDraft>(() => {
    const cached = work.drafts[cacheKey] as CachedDraft | undefined;
    if (cached) return cached;
    const draft = taskDraft(task);
    return { initial: { draft, revision: task.revision }, draft };
  });
  const initial = opening.initial;
  const [draft, setDraft] = useState(opening.draft);
  const [localError, setLocalError] = useState('');
  const [confirmReload, setConfirmReload] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const message = localError || error;
  const dirty = draftKey(draft) !== draftKey(initial.draft);
  const boardGroups = groups.filter((group) => group.boardId === task.boardId);
  const boardTasks = tasks.filter((item) => item.boardId === task.boardId);
  const childIds = new Map<string, string[]>();
  for (const item of boardTasks) {
    if (item.parentId) childIds.set(item.parentId, [...(childIds.get(item.parentId) ?? []), item.id]);
  }
  const excludedParents = new Set<string>();
  const queue = [task.id];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (excludedParents.has(current)) continue;
    excludedParents.add(current);
    queue.push(...(childIds.get(current) ?? []));
  }
  const possibleParents = boardTasks.filter((item) => !excludedParents.has(item.id));

  useEffect(() => { if (message) errorRef.current?.focus(); }, [message]);
  useEffect(() => { if (confirmReload) confirmationRef.current?.focus(); }, [confirmReload]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  function patch(value: Partial<Draft>) {
    const next = { ...draft, ...value };
    const nextDirty = draftKey(next) !== draftKey(initial.draft);
    setDraft(next);
    work.setDraft(cacheKey, nextDirty ? { initial, draft: next } satisfies CachedDraft : null);
    setLocalError('');
    onDirtyChange(nextDirty);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || pending) return;
    if (!draft.title.trim()) { setLocalError('Enter a task title.'); return; }
    const position = Number(draft.position);
    if (!draft.position.trim() || !Number.isSafeInteger(position) || position < 0 || position > 2147483646) {
      setLocalError('Enter a whole-number order of 0 or more.'); return;
    }
    setLocalError('');
    try {
      const ok = await save({ action: 'updateTask', id: task.id, revision: initial.revision,
        patch: { ...draft, title: draft.title.trim(), position } });
      if (ok) { work.setDraft(cacheKey, null); onDirtyChange(false); saved(); }
    } catch {
      setLocalError('The task could not be saved. Your edits are still here. Try saving again.');
    }
  }

  if (!canEdit) {
    const assignees = task.assigneeIds.map((memberId) => members.find((member) => member.id === memberId)?.name ?? 'Former member');
    return <div className="saved-task-editor">
      <p className="saved-task-view-title">{task.title}</p>
      <p className="detail-empty">You have viewing access. Ask an owner or editor to make changes.</p>
      <dl className="saved-task-facts">
        <div><dt>Status</dt><dd><StatusLabel status={task.status} /></dd></div>
        <div><dt>Priority</dt><dd>{task.priority}</dd></div>
        <div><dt>Group</dt><dd>{groups.find((group) => group.id === task.groupId)?.name ?? 'Unavailable group'}</dd></div>
        <div><dt>Due date</dt><dd>{task.dueDate ? dateFormat.format(new Date(`${task.dueDate}T00:00:00Z`)) : 'No date'}</dd></div>
        <div><dt>Assignees</dt><dd>{assignees.join(', ') || 'Unassigned'}</dd></div>
        <div><dt>Parent task</dt><dd>{task.parentId ? tasks.find((item) => item.id === task.parentId)?.title ?? 'Unavailable task' : 'None'}</dd></div>
      </dl>
      <p className="dialog-note">Notes, checklists and files arrive in later milestones.</p>
      <Button onClick={close}>Close task</Button>
    </div>;
  }

  return <form className="saved-task-editor" onSubmit={submit} aria-busy={pending}>
    {message && <div className="saved-task-error">
      <p ref={errorRef} tabIndex={-1} role="alert" className="form-error">{message}</p>
      <Button disabled={pending} onClick={() => dirty ? setConfirmReload(true) : reload()}>Reload saved task</Button>
    </div>}
    {confirmReload && <section className="saved-task-reload" aria-label="Discard edits before reloading">
      <p ref={confirmationRef} tabIndex={-1}>Reloading replaces your unsaved edits with the saved task.</p>
      <div className="saved-task-actions">
        <Button disabled={pending} onClick={reload}>Discard edits and reload</Button>
        <Button variant="ghost" onClick={() => setConfirmReload(false)}>Keep editing</Button>
      </div>
    </section>}
    <fieldset className="saved-task-fields" disabled={pending || confirmReload}>
      <legend className="sr-only">Task details</legend>
      <label className="saved-task-label">Title<input name="task-title" autoComplete="off" required maxLength={240} value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
      <div className="saved-task-grid">
        <label className="saved-task-label">Status<select name="task-status" value={draft.status} onChange={(event) => patch({ status: event.target.value as WorkTask['status'] })}>
          <option>To do</option><option>In progress</option><option>Done</option>
        </select></label>
        <label className="saved-task-label">Priority<select name="task-priority" value={draft.priority} onChange={(event) => patch({ priority: event.target.value as WorkTask['priority'] })}>
          <option>Low</option><option>Medium</option><option>High</option>
        </select></label>
        <DatePicker label="Due date" value={draft.dueDate ?? ''} baseDate={localToday()} onChange={(dueDate) => patch({ dueDate: dueDate || null })} />
        <label className="saved-task-label">Group<select name="task-group" value={draft.groupId} onChange={(event) => patch({ groupId: event.target.value })}>
          {boardGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select></label>
      </div>
      <div className="saved-task-assignees"><span>Assignees</span><AssigneePicker people={members} disabled={pending || confirmReload} value={draft.assigneeIds} taskTitle={draft.title || 'this task'} onChange={(assigneeIds) => patch({ assigneeIds })} /></div>
      <label className="saved-task-label">Parent task<select name="task-parent" value={draft.parentId ?? ''} onChange={(event) => patch({ parentId: event.target.value || null })}>
        <option value="">None — standalone task</option>{possibleParents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select><span className="saved-task-hint">Choose a parent to make this a subtask.</span></label>
      <label className="saved-task-label">Order in group<input name="task-position" type="number" inputMode="numeric" autoComplete="off" min={0} max={2147483646} step={1} required value={draft.position} aria-describedby={`${id}-order-hint`} onChange={(event) => patch({ position: event.target.value })} />
        <span id={`${id}-order-hint`} className="saved-task-hint">Lower numbers appear first in the group.</span>
      </label>
    </fieldset>
    <p className="dialog-note">Notes, checklists and files arrive in later milestones.</p>
    <div className="saved-task-actions"><Button type="submit" variant="primary" disabled={pending || confirmReload}>{pending ? 'Saving…' : 'Save task'}</Button><Button disabled={pending} variant="ghost" onClick={close}>Cancel</Button></div>
    <p className="saved-task-hint" aria-live="polite">{dirty ? 'Unsaved changes' : 'Changes are saved when you choose Save task.'}</p>
  </form>;
}
