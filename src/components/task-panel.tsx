'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useBackdropDismiss } from './use-backdrop-dismiss';
import { Button } from './ui';
import { useWorkspace } from './demo-provider';
import { useTaskNavigation } from './task-navigation';
import { TaskDetailsForm, type TaskDraft } from './task-details-form';
import { boardFor } from '@/lib/demo';

export function TaskPanel() {
  const { tasks, documents, updateTask, drafts, setDraft } = useWorkspace();
  const { taskId, closeTask, currentHref, rememberOrigin } = useTaskNavigation();
  const backdrop = useBackdropDismiss(closeTask);
  const task = tasks.find((item) => item.id === taskId);
  const dialog = useRef<HTMLDialogElement>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  useEffect(() => {
    if (taskId && !dialog.current?.open) dialog.current?.showModal();
  }, [taskId]);
  if (!taskId) return null;
  const draft: TaskDraft = { checklist: drafts[`${taskId}:checklist`] ?? '', subtask: drafts[`${taskId}:subtask`] ?? '' };
  const setTaskDraft = (patch: Partial<TaskDraft>) => {
    for (const [key, value] of Object.entries(patch)) setDraft(`${taskId}:${key}`, value || null);
  };
  return <dialog ref={dialog} {...backdrop} className="task-detail-dialog" aria-labelledby="task-panel-title" onCancel={(event) => { event.preventDefault(); closeTask(); }}>
    <div className="task-detail-heading"><h2 id="task-panel-title">{task?.title ?? 'Task not found'}</h2><Button variant="ghost" className="icon-button" aria-label="Close task details" onClick={closeTask}><X size={20} aria-hidden="true" /></Button></div>
    {task ? <>
      <p className="page-description">{boardFor(task.boardId)?.name}</p>
      <p className="session-note">Changes kept for this demo session. Refresh resets edits. Unfinished checklist and subtask input stays when you close this panel.</p>
      <TaskDetailsForm task={task} draft={draft} setDraft={setTaskDraft} />
      <section className="task-detail-section" aria-labelledby="task-docs-heading"><h3 id="task-docs-heading">Linked document</h3>
        <label className="task-linked-doc">Document<select value={task.documentId ?? ''} onChange={(event) => setLinkError(updateTask(task.id, { documentId: event.target.value || undefined }))}><option value="">No linked document</option>{documents.filter((doc) => doc.boardId === task.boardId).map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></label>
        {linkError && <p role="alert" className="form-error">{linkError}</p>}
        {task.documentId ? <Link className="button button--secondary" href={`/docs/${task.documentId}?returnTo=${encodeURIComponent(currentHref)}`} onClick={() => rememberOrigin()}>Open {documents.find((doc) => doc.id === task.documentId)?.title ?? 'document'}</Link> : <p className="detail-empty">Choose a document from this board to connect it to the task.</p>}
      </section>
      <section className="task-detail-section"><h3>Planned tools</h3><p className="detail-empty">Dependencies, time entries and activity arrive in later milestones.</p></section>
      <Link className="text-link" href={`/boards/${task.boardId}?task=${task.id}`} scroll={false}>View task in its board</Link>
    </> : <p>This task is not in the demo session. Close this panel to return to your work.</p>}
  </dialog>;
}
