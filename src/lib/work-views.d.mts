import type { WorkTask } from './work';
export type BoardView = 'table' | 'kanban' | 'calendar';
export const taskStatuses: WorkTask['status'][];
export function readBoardView(params: { get(key: string): string | null }): BoardView;
export function boardViewHref(pathname: string, params: { toString(): string }, changes: { view?: BoardView; month?: string }): string;
export function readCalendarMonth(value: string | null, today: string): string;
export function shiftCalendarMonth(month: string, offset: number): string | null;
export function groupTasksByStatus<T extends Pick<WorkTask, 'status'>>(tasks: readonly T[]): { status: WorkTask['status']; tasks: T[] }[];
export function calendarTasks<T extends Pick<WorkTask, 'dueDate'>>(tasks: readonly T[], month: string): { days: { date: string; tasks: T[] }[]; cells: ({ date: string; tasks: T[] } | null)[]; undated: T[]; outsideMonth: number; scheduled: number };
