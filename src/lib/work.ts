import type { TimeEntry } from './time';
export type WorkRole = 'owner' | 'editor' | 'viewer';
export type WorkBoard = {
  id: string;
  name: string;
  description: string;
  revision: number;
  archivedAt?: string | null;
  archivedBy?: string | null;
};
export type WorkGroup = { id: string; boardId: string; name: string; position: number; revision: number };
export type WorkColumn = {
  id: string;
  boardId: string;
  name: string;
  kind: 'text' | 'status' | 'number' | 'date' | 'link';
  configuration: { options?: string[]; format?: 'number' | 'cost'; currency?: string };
  position: number;
  revision: number;
};
export type WorkChecklistItem = { id: string; label: string; done: boolean; position: number };
export type WorkFieldValue = { columnId: string; value: string | number };
export type WorkTask = {
  dependencyIds?: string[];
  updatedAt?: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveBatchId?: string | null;
  boardArchived?: boolean;
  id: string;
  boardId: string;
  groupId: string;
  parentId: string | null;
  title: string;
  status: 'To do' | 'In progress' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string | null;
  position: number;
  revision: number;
  assigneeIds: string[];
  notes: string;
  checklist: WorkChecklistItem[];
  fields: WorkFieldValue[];
};
export type WorkMember = { id: string; name: string; email: string; role: WorkRole };
export type WorkSnapshot = {
  activeTimer?: TimeEntry | null;
  serverNow?: string;
  archivedBoards: WorkBoard[];
  archivedTasks: WorkTask[];
  boards: WorkBoard[];
  columns: WorkColumn[];
  groups: WorkGroup[];
  tasks: WorkTask[];
  members: WorkMember[];
  unreadNotifications: number;
  actor: { id: string; name: string; role: WorkRole };
};
export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function workDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${value}T12:00:00Z`))
    : 'No date';
}
