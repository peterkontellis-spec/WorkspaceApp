'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Button, StatusLabel } from './ui';
import { useWorkspace } from './demo-provider';
import { useTaskNavigation } from './task-navigation';
import { boardFor, formatDue, members } from '@/lib/demo';

export function TaskPanel() {
  const { tasks } = useWorkspace();
  const { taskId, closeTask } = useTaskNavigation();
  const task = tasks.find((item) => item.id === taskId);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (taskId && !dialog.current?.open) dialog.current?.showModal();
  }, [taskId]);
  if (!taskId) return null;
  return <dialog ref={dialog} className="task-detail-dialog" aria-labelledby="task-panel-title" onCancel={(event) => { event.preventDefault(); closeTask(); }}>
    <div className="task-detail-heading"><h2 id="task-panel-title">{task?.title ?? 'Task not found'}</h2><Button variant="ghost" className="icon-button" aria-label="Close task details" onClick={closeTask}><X size={20} aria-hidden="true" /></Button></div>
    {task ? <><p className="page-description">{boardFor(task.boardId)?.name}</p><dl className="task-summary"><dt>Status</dt><dd><StatusLabel status={task.status} /></dd><dt>Due date</dt><dd>{formatDue(task.dueDate)}</dd><dt>Priority</dt><dd>{task.priority}</dd><dt>Assignees</dt><dd>{task.assigneeIds.map((id) => members.find((member) => member.id === id)?.name).join(', ') || 'Unassigned'}</dd></dl><Link className="button button--secondary" href={`/boards/${task.boardId}`}>Open board</Link><p className="session-note">Sample task. Editing and linked documents follow in M1.4–M1.5.</p></> : <p>This task is not in the demo session. Close this panel to return to your work.</p>}
  </dialog>;
}
