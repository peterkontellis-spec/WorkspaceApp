'use client';
import { useEffect, useState } from 'react';
import { useWork } from './work-provider';
import { Button } from './ui';
import type { WorkBoard, WorkTask } from '@/lib/work';

export function ArchiveControl({
  item,
  kind,
  blocked = false,
  onApplied,
}: {
  item: WorkBoard | WorkTask;
  kind: 'task' | 'board';
  blocked?: boolean;
  onApplied?: () => void;
}) {
  const work = useWork();
  const [confirm, setConfirm] = useState(false);
  const [undo, setUndo] = useState(false);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(false), 10000);
    return () => clearTimeout(timer);
  }, [undo]);
  const permitted = kind === 'board' ? work.data?.actor.role === 'owner' : work.data?.actor.role !== 'viewer';
  if (!permitted) return null;
  const boardArchived = 'boardArchived' in item && item.boardArchived;
  const archived = Boolean(item.archivedAt);
  const title = 'title' in item ? item.title : item.name;
  async function apply() {
    const action = `${archived ? 'restore' : 'archive'}${kind === 'board' ? 'Board' : 'Task'}`;
    if (await work.save({ action, id: item.id, revision: item.revision })) {
      setConfirm(false);
      setUndo(!archived);
      onApplied?.();
    }
  }
  const descendants = new Set([item.id]);
  if (kind === 'task') {
    let added = true;
    while (added) {
      added = false;
      for (const task of work.data?.tasks ?? [])
        if (task.parentId && descendants.has(task.parentId) && !descendants.has(task.id)) {
          descendants.add(task.id);
          added = true;
        }
    }
  }
  if (boardArchived)
    return <p className="auth-hint">An owner must restore this board before its tasks can be restored.</p>;
  return (
    <div className="archive-control">
      {confirm ? (
        <>
          <p>
            {archived
              ? `Restore “${title}” to active work?`
              : kind === 'board'
                ? `Archive “${title}” and hide its tasks from active work? History and files will be kept.`
                : `Archive “${title}”${descendants.size > 1 ? ` and ${descendants.size - 1} active subtasks` : ''}? History and files will be kept.`}
          </p>
          <div className="saved-actions">
            <Button disabled={blocked || work.pending} onClick={() => void apply()}>
              {archived ? 'Confirm restore' : 'Confirm archive'}
            </Button>
            <Button variant="ghost" disabled={work.pending} onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="ghost"
          disabled={blocked || work.pending}
          onClick={() => (undo && archived ? void apply() : setConfirm(true))}
        >
          {undo && archived ? 'Undo archive' : `${archived ? 'Restore' : 'Archive'} ${kind}`}
        </Button>
      )}
    </div>
  );
}
