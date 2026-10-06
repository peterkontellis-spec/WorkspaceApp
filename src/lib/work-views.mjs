const views = new Set(['table', 'kanban', 'calendar']);
export const taskStatuses = ['To do', 'In progress', 'Done'];

export function readBoardView(params) {
  const view = params.get('view');
  return views.has(view) ? view : 'table';
}
export function boardViewHref(pathname, params, changes) {
  const search = new URLSearchParams(params.toString());
  if (changes.view) search.set('view', changes.view);
  if (changes.month) search.set('month', changes.month);
  search.delete('task');
  return `${pathname}${search.size ? `?${search}` : ''}`;
}
export function readCalendarMonth(value, today) {
  return typeof value === 'string' && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : today.slice(0, 7);
}
export function shiftCalendarMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const absolute = (year - 1) * 12 + number - 1 + offset;
  if (absolute < 0 || absolute >= 9999 * 12) return null;
  return `${String(Math.floor(absolute / 12) + 1).padStart(4, '0')}-${String((absolute % 12) + 1).padStart(2, '0')}`;
}
export function groupTasksByStatus(tasks) {
  return taskStatuses.map((status) => ({ status, tasks: tasks.filter((task) => task.status === status) }));
}
// UTC is used only for calendar arithmetic; date-only task values never change timezone.
export function calendarTasks(tasks, month) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const byDate = new Map();
  const undated = [];
  let outsideMonth = 0;
  for (const task of tasks) {
    if (!task.dueDate) undated.push(task);
    else if (task.dueDate.slice(0, 7) !== month) outsideMonth++;
    else {
      if (!byDate.has(task.dueDate)) byDate.set(task.dueDate, []);
      byDate.get(task.dueDate).push(task);
    }
  }
  const days = Array.from({ length: last.getUTCDate() }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    return { date, tasks: byDate.get(date) ?? [] };
  });
  const leading = (first.getUTCDay() + 6) % 7;
  const cells = [...Array(leading).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return { days, cells, undated, outsideMonth, scheduled: tasks.length - undated.length - outsideMonth };
}
