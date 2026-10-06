'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { WorkColumn, WorkChecklistItem, WorkGroup, WorkMember, WorkTask } from '@/lib/work';
import { localToday } from '@/lib/work';
import { AssigneePicker } from './assignee-picker';
import { DatePicker } from './date-picker';
import { Button, StatusLabel } from './ui';
import { useWork } from './work-provider';
import { SavedFieldValue } from './saved-field-value';
import { SavedTaskAttachments } from './saved-files';
import './saved-task-editor.css';

type Draft = Pick<WorkTask, 'title' | 'status' | 'priority' | 'groupId' | 'parentId' | 'dueDate' | 'assigneeIds'> & { position: string; notes: string; checklist: WorkChecklistItem[]; fields: Record<string, string>; removedChecklist: WorkChecklistItem[] };
type CachedDraft = { initial: { draft: Draft; revision: number; columns: WorkColumn[] }; draft: Draft };

export type SavedTaskEditorProps = {
  task: WorkTask;
  groups: WorkGroup[];
  columns: WorkColumn[];
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

function taskDraft(task: WorkTask, columns: WorkColumn[]): Draft {
  return { title: task.title, status: task.status, priority: task.priority, groupId: task.groupId,
    parentId: task.parentId, dueDate: task.dueDate, position: String(task.position), assigneeIds: [...task.assigneeIds], notes: task.notes ?? '', checklist: (task.checklist ?? []).map((item) => ({ ...item })),
    fields: Object.fromEntries(columns.map((column) => [column.id, String(task.fields?.find((field) => field.columnId === column.id)?.value ?? '')])), removedChecklist: [] };
}

function draftKey(draft: Draft) {
  return JSON.stringify({ ...draft, assigneeIds: [...draft.assigneeIds].sort() });
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

export function SavedTaskEditor({ task, columns, groups, tasks, members, canEdit, save, pending, error, close, saved, reload, onDirtyChange }: SavedTaskEditorProps) {
  const work = useWork();
  const cacheKey = `task:${task.id}`;
  // A refreshed roster or board must not silently overwrite a draft or advance its revision.
  // The layout provider also keeps these values when browser history unmounts the panel.
  const [opening] = useState<CachedDraft>(() => {
    const cached = work.drafts[cacheKey] as CachedDraft | undefined;
    if (cached) return cached;
    const openingColumns = columns.filter((column) => column.boardId === task.boardId).map((column) => ({ ...column, configuration: { ...column.configuration, options: column.configuration.options ? [...column.configuration.options] : undefined } }));
    const draft = taskDraft(task, openingColumns);
    return { initial: { draft, revision: task.revision, columns: openingColumns }, draft };
  });
  const initial = opening.initial;
  const [draft, setDraft] = useState(opening.draft);
  const [localError, setLocalError] = useState('');
  const [confirmReload, setConfirmReload] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const focusChecklist = useRef<string | null>(null);
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
  useEffect(() => {
    if (!focusChecklist.current) return;
    const input = formRef.current?.elements.namedItem(`checklist-${focusChecklist.current}`);
    if (input instanceof HTMLInputElement) { input.focus(); focusChecklist.current = null; }
  }, [draft.checklist]);

  function patch(value: Partial<Draft>) {
    const next = { ...draft, ...value };
    const nextDirty = draftKey(next) !== draftKey(initial.draft);
    setDraft(next);
    work.setDraft(cacheKey, nextDirty ? { initial, draft: next } satisfies CachedDraft : null);
    setLocalError('');
    onDirtyChange(nextDirty);
  }

  function addChecklist() {
    const itemId = crypto.randomUUID();
    focusChecklist.current = itemId;
    patch({ checklist: [...draft.checklist, { id: itemId, label: '', done: false, position: Math.max(-1, ...draft.checklist.map((item) => item.position), ...draft.removedChecklist.map((item) => item.position)) + 1 }] });
  }

  function patchChecklist(itemId: string, value: Partial<WorkChecklistItem>) {
    patch({ checklist: draft.checklist.map((item) => item.id === itemId ? { ...item, ...value } : item) });
  }

  function removeChecklist(itemId: string) {
    const removed = draft.checklist.find((item) => item.id === itemId);
    if (removed) patch({ checklist: draft.checklist.filter((item) => item.id !== itemId), removedChecklist: [...draft.removedChecklist, removed] });
  }

  function undoChecklist(itemId: string) {
    const removed = draft.removedChecklist.find((item) => item.id === itemId);
    if (removed) patch({ checklist: [...draft.checklist, removed].sort((a, b) => a.position - b.position), removedChecklist: draft.removedChecklist.filter((item) => item.id !== itemId) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || pending) return;
    if (!draft.title.trim()) { setLocalError('Enter a task title.'); return; }
    const position = Number(draft.position);
    if (!draft.position.trim() || !Number.isSafeInteger(position) || position < 0 || position > 2147483646) {
      setLocalError('Enter a whole-number order of 0 or more.'); return;
    }
    if (draft.checklist.some((item) => !item.label.trim())) { setLocalError('Enter a label for each checklist item, or remove the empty item.'); return; }
    const fields: { columnId: string; revision: number; value: string | number | null }[] = [];
    for (const column of initial.columns) {
      const raw = draft.fields[column.id] ?? '';
      let value: string | number | null = raw === '' ? null : raw;
      if (column.kind === 'number' && value !== null) {
        value = Number(raw);
        if (!raw.trim() || !Number.isFinite(value) || Math.abs(value) > 1e12) { setLocalError(`Enter a number between −1 trillion and 1 trillion for ${column.name}.`); return; }
        if (column.configuration.format === 'cost') {
          const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
          if ((coefficient.split('.')[1]?.length ?? 0) - Number(exponent) > 2) { setLocalError(`Use at most two decimal places for ${column.name}.`); return; }
        }
      }
      if (column.kind === 'link' && value !== null && !safeLink(String(value))) { setLocalError(`Enter a full http:// or https:// address for ${column.name}.`); return; }
      fields.push({ columnId: column.id, revision: column.revision, value });
    }
    setLocalError('');
    try {
      const ok = await save({ action: 'updateTask', id: task.id, revision: initial.revision,
        patch: { title: draft.title.trim(), status: draft.status, priority: draft.priority, groupId: draft.groupId, parentId: draft.parentId, dueDate: draft.dueDate, assigneeIds: draft.assigneeIds, position, notes: draft.notes, checklist: draft.checklist.map((item, index) => ({ ...item, label: item.label.trim(), position: index })), fields } });
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
      <section className="saved-task-section"><h3>Columns</h3>{columns.filter((column) => column.boardId === task.boardId).length ? <dl className="saved-task-facts">{columns.filter((column) => column.boardId === task.boardId).map((column) => <div key={column.id}><dt>{column.name}</dt><dd><SavedFieldValue column={column} value={task.fields.find((field) => field.columnId === column.id)?.value} /></dd></div>)}</dl> : <p className="detail-empty">This board has no custom columns.</p>}</section>
      <section className="saved-task-section"><h3>Notes</h3><p className="saved-task-notes">{task.notes || 'No notes yet.'}</p></section>
      <section className="saved-task-section"><h3>Checklist</h3>{task.checklist.length ? <ul className="saved-task-checklist-read">{task.checklist.map((item) => <li key={item.id}><span className="saved-task-hint">{item.done ? 'Done' : 'To do'}</span><span>{item.label}</span></li>)}</ul> : <p className="detail-empty">No checklist items yet.</p>}</section>
      <SavedTaskAttachments taskId={task.id} canEdit={false}/>
      <Button onClick={close}>Close task</Button>
    </div>;
  }

  return <><form ref={formRef} className="saved-task-editor" onSubmit={submit} aria-busy={pending}>
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
      <section className="saved-task-section" aria-labelledby={`${id}-columns`}><h3 id={`${id}-columns`}>Columns</h3>
        {initial.columns.length ? <div className="saved-task-grid">{initial.columns.map((column) => <CustomField key={column.id} column={column} value={draft.fields[column.id] ?? ''} change={(value) => patch({ fields: { ...draft.fields, [column.id]: value } })} />)}</div> : <p className="detail-empty">Add custom columns from the board.</p>}
      </section>
      <section className="saved-task-section" aria-labelledby={`${id}-notes`}><h3 id={`${id}-notes`}>Notes</h3><label className="saved-task-label"><span className="sr-only">Task notes</span><textarea name="task-notes" rows={6} maxLength={50000} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /><span className="saved-task-hint">Plain text. Line breaks are kept.</span></label></section>
      <section className="saved-task-section" aria-labelledby={`${id}-checklist`}><h3 id={`${id}-checklist`}>Checklist</h3>
        <p className="saved-task-hint">{draft.checklist.length ? `${draft.checklist.filter((item) => item.done).length} of ${draft.checklist.length} complete` : 'Break the task into smaller steps.'}</p>
        <ul className="saved-task-checklist">{draft.checklist.map((item, index) => <li key={item.id}>
          <label className="saved-task-check"><input type="checkbox" checked={item.done} onChange={(event) => patchChecklist(item.id, { done: event.target.checked })} /><span className="sr-only">Mark {item.label || `item ${index + 1}`} complete</span></label>
          <label className="saved-task-label"><span className="sr-only">Checklist item {index + 1}</span><input name={`checklist-${item.id}`} required maxLength={500} autoComplete="off" value={item.label} onChange={(event) => patchChecklist(item.id, { label: event.target.value })} /></label>
          <Button variant="ghost" onClick={() => removeChecklist(item.id)} aria-label={`Remove ${item.label || `item ${index + 1}`}`}>Remove</Button>
        </li>)}</ul>
        <Button disabled={draft.checklist.length >= 50} onClick={addChecklist}>Add checklist item</Button>
        {draft.checklist.length >= 50 && <p className="saved-task-hint">Maximum 50 checklist items.</p>}
        {draft.removedChecklist.length > 0 && <div className="saved-task-undo" aria-live="polite">{draft.removedChecklist.map((item) => <div key={item.id}><span>{item.label || 'Empty item'} removed from this draft.</span><Button disabled={draft.checklist.length >= 50} variant="ghost" onClick={() => undoChecklist(item.id)}>Undo removal</Button></div>)}</div>}
      </section>
    </fieldset>
    <div className="saved-task-actions"><Button type="submit" variant="primary" disabled={pending || confirmReload}>{pending ? 'Saving…' : 'Save task'}</Button><Button disabled={pending} variant="ghost" onClick={close}>Cancel</Button></div>
    <p className="saved-task-hint" aria-live="polite">{dirty ? 'Unsaved changes' : 'Changes are saved when you choose Save task.'}</p>
  </form><SavedTaskAttachments taskId={task.id} canEdit={canEdit} blocked={dirty || pending || confirmReload}/></>;
}

function safeLink(value: string) {
  try { const parsed = new URL(value); return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password; } catch { return false; }
}

function CustomField({ column, value, change }: { column: WorkColumn; value: string; change: (value: string) => void }) {
  const label = column.configuration.format === 'cost' ? `${column.name} (${column.configuration.currency ?? 'EUR'})` : column.name;
  if (column.kind === 'date') return <DatePicker label={label} value={value} baseDate={localToday()} onChange={change} />;
  if (column.kind === 'status') return <label className="saved-task-label">{label}<select name={`field-${column.id}`} value={value} onChange={(event) => change(event.target.value)}><option value="">Not set</option>{column.configuration.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  return <label className="saved-task-label">{label}<input name={`field-${column.id}`} type={column.kind === 'number' ? 'number' : column.kind === 'link' ? 'url' : 'text'} inputMode={column.kind === 'number' ? 'decimal' : undefined} autoComplete="off" maxLength={column.kind === 'link' ? 2048 : column.kind === 'text' ? 1000 : undefined} min={column.kind === 'number' ? -1e12 : undefined} max={column.kind === 'number' ? 1e12 : undefined} step={column.kind === 'number' ? column.configuration.format === 'cost' ? '0.01' : 'any' : undefined} value={value} onChange={(event) => change(event.target.value)} />{column.kind === 'link' && <span className="saved-task-hint">Full http:// or https:// address.</span>}</label>;
}
