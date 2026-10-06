'use client';

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useBackdropDismiss } from './use-backdrop-dismiss';
import Link from 'next/link';
import { DEMO_DATE, boardFor, formatDue, members, type Member, type Status, type Task } from '@/lib/demo';

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button type="button" className={`button button--${variant} ${className}`} {...props} />;
}

export function Field({ label, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const generatedId = useId();
  return <label className={`field ${className}`} htmlFor={id ?? generatedId}><span className="sr-only">{label}</span><input id={id ?? generatedId} {...props} /></label>;
}

export function Panel({ children, className = '', ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={`panel ${className}`} {...props}>{children}</section>;
}

export function StatusLabel({ status }: { status: Status }) {
  return <span className={`status status--${status === 'In progress' ? 'progress' : status === 'Done' ? 'done' : 'todo'}`}><span aria-hidden="true" />{status}</span>;
}

export function Avatar({ member, small = false }: { member: Member; small?: boolean }) {
  return <span className={`avatar avatar--${member.color} ${small ? 'avatar--small' : ''}`} aria-label={member.name}>{member.initials}</span>;
}

export function AvatarStack({ ids }: { ids: readonly string[] }) {
  return <div className="avatar-stack" aria-label="Sample project members">{ids.map((id) => {
    const member = members.find((person) => person.id === id);
    return member ? <Avatar key={id} member={member} small /> : null;
  })}</div>;
}

export function TaskRow({ task, href, onOpen }: { task: Task; href?: string; onOpen?: () => void }) {
  const overdue = task.dueDate && task.dueDate < DEMO_DATE && task.status !== 'Done';
  return <li className="task-row">
    <span className={`task-marker ${task.status === 'Done' ? 'task-marker--done' : ''}`} aria-hidden="true" />
    <div className="task-row__name">{href ? <Link href={href} onClick={onOpen} scroll={false} data-task-id={task.id} className="task-title-link">{task.title}</Link> : <span>{task.title}</span>}<span className="task-row__project">{boardFor(task.boardId)?.name}</span></div>
    <StatusLabel status={task.status} />
    <span className={`task-row__date ${overdue ? 'task-row__date--overdue' : ''}`}>{overdue ? 'Overdue · ' : ''}{formatDue(task.dueDate)}</span>
  </li>;
}

export function Dialog({ open, onClose, title, children, className = '' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdrop = useBackdropDismiss(onClose);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={dialogRef} aria-labelledby={titleId} className={`dialog ${className}`} onClose={onClose} onCancel={onClose} {...backdrop}>
    <div className="dialog__surface">
      <div className="dialog__heading"><h2 id={titleId}>{title}</h2><Button variant="ghost" className="icon-button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={20} aria-hidden="true" /></Button></div>
      {children}
    </div>
  </dialog>;
}
