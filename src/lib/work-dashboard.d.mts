import type { WorkBoard, WorkMember, WorkSnapshot, WorkTask } from './work';

export type DashboardSummary = {
  total: number;
  open: number;
  done: number;
  toDo: number;
  inProgress: number;
  overdue: number;
  today: number;
  upcoming: number;
  undated: number;
  completionPercent: number | null;
};
export type WorkDashboard = {
  personal: DashboardSummary;
  team: DashboardSummary;
  personalTasks: WorkTask[];
  personalBuckets: Record<'overdue' | 'today' | 'upcoming' | 'undated', WorkTask[]>;
  overdueTasks: WorkTask[];
  boards: { board: WorkBoard; summary: DashboardSummary }[];
  members: { member: WorkMember; summary: DashboardSummary }[];
  unassigned: DashboardSummary;
  unavailableAssignees: DashboardSummary;
  unavailableAssigneeTasks: WorkTask[];
  recentTasks: WorkTask[];
};
export function localDateKey(date?: Date, timeZone?: string): string;
export function dashboardSummary(tasks: readonly WorkTask[], todayISO: string): DashboardSummary;
export function buildWorkDashboard(snapshot: WorkSnapshot, todayISO: string): WorkDashboard;
