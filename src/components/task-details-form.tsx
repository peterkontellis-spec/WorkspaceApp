'use client';

import { useState } from 'react';
import { Button } from './ui';
import { useWorkspace } from './demo-provider';
import { members } from '@/lib/demo';
import { taskGroups, taskPriorities, taskStatuses, type DemoTask } from '@/lib/demo-state';

export type TaskDraft = { checklist: string; subtask: string };

export function TaskDetailsForm({ task, draft, setDraft }: { task: DemoTask; draft: TaskDraft; setDraft: (patch: Partial<TaskDraft>) => void }) {
  const { updateTask } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  function patch(value: Partial<DemoTask>) { const result = updateTask(task.id, value); setError(result); return !result; }
  return <div className="task-detail-fields">
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="task-field-grid">
      <label>Status<select value={task.status} onChange={(event) => patch({ status: event.target.value as DemoTask['status'] })}>{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>Priority<select value={task.priority} onChange={(event) => patch({ priority: event.target.value as DemoTask['priority'] })}>{taskPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
      <label>Due date<input type="date" value={task.dueDate ?? ''} onChange={(event) => patch({ dueDate: event.target.value || null })} /></label>
      <label>Group<select value={task.group} onChange={(event) => patch({ group: event.target.value as DemoTask['group'] })}>{taskGroups.map((group) => <option key={group}>{group}</option>)}</select></label>
    </div>
    <fieldset className="task-assignees"><legend>Assignees</legend>{members.map((member) => <label key={member.id}><input type="checkbox" checked={task.assigneeIds.includes(member.id)} onChange={(event) => patch({ assigneeIds: event.target.checked ? [...task.assigneeIds, member.id] : task.assigneeIds.filter((id) => id !== member.id) })} />{member.name}</label>)}</fieldset>
    <label className="task-notes">Notes<textarea name="task-notes" rows={5} value={task.notes} onChange={(event) => patch({ notes: event.target.value })} placeholder="Add context for this task…" /></label>
    <section className="task-detail-section" aria-labelledby="task-checklist-heading">
      <h3 id="task-checklist-heading">Checklist <span className="subtle-label">{task.checklist.filter((item) => item.done).length}/{task.checklist.length}</span></h3>
      {task.checklist.length ? <ul className="detail-item-list">{task.checklist.map((item) => <li key={item.id}><label><input type="checkbox" checked={item.done} onChange={(event) => patch({ checklist: task.checklist.map((entry) => entry.id === item.id ? { ...entry, done: event.target.checked } : entry) })} /><span className={item.done ? 'completed-text' : ''}>{item.text}</span></label></li>)}</ul> : <p className="detail-empty">No checklist items yet.</p>}
      <form className="detail-add-form" onSubmit={(event) => { event.preventDefault(); if (!draft.checklist.trim()) { setError('Enter a checklist item.'); return; } if (patch({ checklist: [...task.checklist, { id: crypto.randomUUID(), text: draft.checklist, done: false }] })) setDraft({ checklist: '' }); }}>
        <label>New checklist item<input name="checklist-item" value={draft.checklist} onChange={(event) => setDraft({ checklist: event.target.value })} placeholder="For example, confirm the scope…" /></label><Button type="submit">Add item</Button>{draft.checklist && <Button onClick={() => setDraft({ checklist: '' })}>Clear draft</Button>}
      </form>
    </section>
    <section className="task-detail-section" aria-labelledby="task-subtasks-heading">
      <h3 id="task-subtasks-heading">Subtasks</h3><p className="detail-empty">Small tasks with their own status.</p>
      {task.subtasks.length ? <ul className="detail-item-list">{task.subtasks.map((item) => <li key={item.id} className="subtask-item"><span>{item.title}</span><label><span className="sr-only">Status for {item.title}</span><select value={item.status} onChange={(event) => patch({ subtasks: task.subtasks.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value as DemoTask['status'] } : entry) })}>{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></li>)}</ul> : <p className="detail-empty">No subtasks yet.</p>}
      <form className="detail-add-form" onSubmit={(event) => { event.preventDefault(); if (!draft.subtask.trim()) { setError('Enter a subtask title.'); return; } if (patch({ subtasks: [...task.subtasks, { id: crypto.randomUUID(), title: draft.subtask, status: 'To do' }] })) setDraft({ subtask: '' }); }}>
        <label>New subtask<input name="subtask-title" value={draft.subtask} onChange={(event) => setDraft({ subtask: event.target.value })} placeholder="For example, gather feedback…" /></label><Button type="submit">Add subtask</Button>{draft.subtask && <Button onClick={() => setDraft({ subtask: '' })}>Clear draft</Button>}
      </form>
    </section>
    <section className="task-detail-section" aria-labelledby="task-files-heading"><h3 id="task-files-heading">Files</h3>{task.attachments.length ? <ul className="sample-files">{task.attachments.map((file) => <li key={file.id}><span>{file.name}</span><span>{file.size} · sample metadata</span></li>)}</ul> : <p className="detail-empty">No sample files on this task.</p>}<p className="detail-empty">Uploads and downloads arrive with persistent storage.</p></section>
  </div>;
}
