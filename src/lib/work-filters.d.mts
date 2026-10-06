import type { WorkTask } from './work';

export type WorkFilters = { q: string; status: string; assignee: string; priority: string; due: string };
export function readWorkFilters(params: { get(key: string): string | null }): WorkFilters;
export function hasWorkFilters(filters: WorkFilters): boolean;
export function filterWorkTasks<
  T extends Pick<WorkTask, 'title' | 'notes' | 'status' | 'priority' | 'assigneeIds' | 'dueDate'>,
>(tasks: readonly T[], filters: WorkFilters, todayISO: string): T[];
