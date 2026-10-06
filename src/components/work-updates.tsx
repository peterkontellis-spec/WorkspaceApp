'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { useWork } from './work-provider';
import './work-updates.css';

type UpdateItem = { id: string; taskId: string; boardId: string; taskTitle: string; actorName: string; summary: string; createdAt: string; readAt?: string | null };
type UpdatePage = { items: UpdateItem[]; nextCursor: string | null };

export function NotificationsLink() {
  const { data } = useWork();
  const unread = data?.unreadNotifications ?? 0;
  return <Link href="/notifications" className="notifications-link" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} title="Notifications">
    <Bell size={20} aria-hidden="true" />
    {unread > 0 ? <span className="notifications-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span> : null}
  </Link>;
}

export function NotificationsPage() {
  const { data } = useWork();
  return <section className="updates-page">
    <div className="page-heading"><div><h1>Notifications</h1><p>Assignments and changes to tasks you’re assigned to.</p></div></div>
    <p className="updates-hint">Your own changes don’t notify you. The bell updates automatically; refresh this list for the latest changes.</p>
    {data ? <UpdateFeed key={data.actor.id} /> : <p role="status">Notifications are available when your workspace is connected.</p>}
  </section>;
}

export function TaskActivity({ taskId }: { taskId: string }) {
  const { data } = useWork();
  return <section className="task-activity" aria-label="Task activity">
    <h3>Activity</h3>
    <p className="updates-hint">Saved task changes, newest first. Earlier edits and attachment changes aren’t included.</p>
    {data ? <UpdateFeed key={`${data.actor.id}:${taskId}`} taskId={taskId} /> : null}
  </section>;
}

function UpdateFeed({ taskId }: { taskId?: string }) {
  const work = useWork();
  const [page, setPage] = useState<UpdatePage | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expired, setExpired] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const heading = useRef<HTMLParagraphElement>(null);

  const load = useCallback(async (before: string | null, moveFocus = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    setLoading(true); setError(''); setNotice('');
    try {
      const params = new URLSearchParams();
      if (taskId) params.set('taskId', taskId);
      if (before) params.set('before', before);
      const response = await fetch(`/api/updates?${params}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const value = await response.json();
      if (current !== generation.current) return;
      if (response.status === 401 || response.status === 403) { setPage(null); setExpired(true); }
      if (!response.ok) throw new Error(value.error || 'Updates could not be loaded. Try Refresh.');
      setPage(value); setCursor(before);
      setNotice(`${value.items.length} ${taskId ? 'activity entries' : 'notifications'} shown${before ? ' from earlier changes' : ', newest first'}.`);
      if (moveFocus) heading.current?.focus();
    } catch (failure) {
      if (!controller.signal.aborted && current === generation.current) setError(failure instanceof Error && !['TypeError', 'TimeoutError'].includes(failure.name) ? failure.message : 'Updates could not be loaded. Check your connection and try Refresh.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load(null);
    return () => { generation.current++; request.current?.abort(); };
  }, [load]);

  async function setRead(item: UpdateItem) {
    if (saving || loading) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setRead', id: item.id, read: !item.readAt }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const value = await response.json();
      if (current !== generation.current) return;
      if (response.status === 401 || response.status === 403) { setPage(null); setExpired(true); }
      if (!response.ok) throw new Error(value.error || 'Read status could not be saved. Try again.');
      setPage(previous => previous ? { ...previous, items: previous.items.map(entry => entry.id === item.id ? { ...entry, readAt: item.readAt ? null : new Date().toISOString() } : entry) } : previous);
      setNotice(item.readAt ? 'Marked unread.' : 'Marked read.');
      // The next regular workspace read updates the bell without clearing task save errors.
    } catch (failure) {
      if (!controller.signal.aborted && current === generation.current) setError(failure instanceof Error && !['TypeError', 'TimeoutError'].includes(failure.name) ? failure.message : 'Read status could not be confirmed. Refresh to check before retrying.');
    } finally {
      if (current === generation.current) setSaving(false);
    }
  }

  if (expired) return <p role="alert">Your access changed. <Link href="/sign-in">Sign in again</Link> to load updates.</p>;
  const busy = loading || saving;
  return <div className="update-feed" aria-busy={busy}>
    <div className="updates-toolbar">
      <p ref={heading} tabIndex={-1} className="updates-hint">{cursor ? 'Earlier changes' : 'Latest changes'}</p>
      <Button disabled={busy || work.syncState === 'expired'} onClick={() => void load(null, true)}>{loading ? 'Loading…' : 'Refresh'}</Button>
    </div>
    <p className="sr-only" role="status">{loading ? 'Loading updates…' : notice}</p>
    {error ? <p className="auth-error" role="alert">{error} {page ? 'The list below may be out of date.' : ''}</p> : null}
    {page?.items.length === 0 ? <p className="updates-empty">{taskId ? 'No recorded changes yet. New task edits will appear here.' : 'No notifications yet. Updates from teammates will appear here when they assign you a task or change one you’re assigned to.'}</p> : null}
    {page && page.items.length > 0 ? <ul className="updates-list">{page.items.map(item => <li key={item.id}>
      <div className="update-copy">
        {!taskId ? <Link className="update-task-link" href={`/boards/${item.boardId}?task=${item.taskId}`}>{item.taskTitle}</Link> : null}
        <p><strong>{item.actorName}</strong><span aria-hidden="true"> · </span>{item.summary}</p>
        <p className="update-meta"><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time>{!taskId ? <span>{item.readAt ? 'Read' : 'Unread'}</span> : null}</p>
      </div>
      {!taskId ? <Button disabled={busy} aria-label={`Mark ${item.taskTitle} notification ${item.readAt ? 'unread' : 'read'}`} onClick={() => void setRead(item)}>{item.readAt ? 'Mark unread' : 'Mark read'}</Button> : null}
    </li>)}</ul> : null}
    <div className="updates-pagination">
      <Button disabled={busy || !cursor} onClick={() => void load(null, true)}>Latest</Button>
      <Button disabled={busy || !page?.nextCursor} onClick={() => void load(page?.nextCursor ?? null, true)}>Older</Button>
    </div>
  </div>;
}
