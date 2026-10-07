import type { WorkRole } from './work';

export type TimeEntry = {
  id: string;
  taskId: string;
  boardId: string;
  taskTitle: string;
  boardName: string;
  userId: string;
  userName: string;
  kind: 'manual' | 'timer';
  workDate: string | null;
  durationSeconds: number | null;
  startedAt: string | null;
  endedAt: string | null;
  adjusted: boolean;
  originalSeconds: number | null;
  notes: string;
  revision: number;
  voidedAt: string | null;
  stopReason: string | null;
  createdAt: string;
};
export type TimeReport = {
  actor: { id: string; role: WorkRole };
  serverNow: string;
  activeTimer: TimeEntry | null;
  entries: TimeEntry[];
  nextCursor: string | null;
  summary: {
    totalSeconds: number;
    byTask: { taskId: string; title: string; boardId: string; seconds: number }[];
    byBoard: { boardId: string; name: string; seconds: number }[];
    byDate: { date: string; seconds: number }[];
  };
};
export function durationLabel(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}
