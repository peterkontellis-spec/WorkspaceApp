'use client';
import Link from 'next/link';
import './active-time.css';
import { useEffect, useState } from 'react';
import type { TimeEntry } from '@/lib/time';
import { durationLabel } from '@/lib/time';
import { useWork } from './work-provider';

export function TimerElapsed({ entry, serverNow }: { entry: TimeEntry; serverNow: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const base = Math.max(0, (Date.parse(serverNow) - Date.parse(entry.startedAt!)) / 1000);
    const received = performance.now();
    const tick = () => setSeconds(Math.floor(base + (performance.now() - received) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [entry.id, entry.startedAt, serverNow]);
  // A visual estimate only. Saved elapsed time always comes from server timestamps.
  return <span className="time-duration">{durationLabel(seconds)}</span>;
}
export function ActiveTimeNotice() {
  const work = useWork();
  const entry = work.data?.activeTimer;
  if (!entry || !work.data?.serverNow) return null;
  return (
    <div className="active-time-notice">
      <Link href="/time">
        <strong>Timer running</strong> · {entry.taskTitle} ·{' '}
        <TimerElapsed entry={entry} serverNow={work.data.serverNow} /> · Open time
      </Link>
    </div>
  );
}
export function TaskTimeLink({ taskId }: { taskId: string }) {
  return (
    <section className="saved-task-section">
      <h3>Time</h3>
      <p className="page-description">Shared time entries, timers and totals for this task.</p>
      <Link className="text-link" href={`/time?taskId=${taskId}`}>
        View or track time for this task
      </Link>
    </section>
  );
}
