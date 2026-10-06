const statuses = new Set(['To do', 'In progress', 'Done']);
const priorities = new Set(['Low', 'Medium', 'High']);
const dueScopes = new Set(['overdue', 'today', 'upcoming', 'none']);

export function readWorkFilters(params) {
  const status = params.get('status') ?? '';
  const priority = params.get('priority') ?? '';
  const due = params.get('due') ?? '';
  return {
    q: (params.get('q') ?? '').slice(0, 200),
    status: statuses.has(status) ? status : '',
    assignee: params.get('assignee') ?? '',
    priority: priorities.has(priority) ? priority : '',
    due: dueScopes.has(due) ? due : '',
  };
}

export function hasWorkFilters(filters) {
  return Boolean(filters.q.trim() || filters.status || filters.assignee || filters.priority || filters.due);
}

// Only pass tasks from the authenticated workspace snapshot. Filtering is a view,
// not an authorization boundary; /api/work verifies current workspace membership.
export function filterWorkTasks(tasks, filters, todayISO) {
  const query = filters.q.slice(0, 200).trim().toLowerCase();
  return tasks.filter(task => {
    if (query && !task.title.toLowerCase().includes(query) && !task.notes.toLowerCase().includes(query)) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.assignee === 'unassigned' ? task.assigneeIds.length !== 0 : filters.assignee && !task.assigneeIds.includes(filters.assignee)) return false;
    if (filters.due === 'none') return task.dueDate === null;
    if (filters.due && task.dueDate === null) return false;
    if (filters.due === 'overdue') return task.dueDate < todayISO;
    if (filters.due === 'today') return task.dueDate === todayISO;
    if (filters.due === 'upcoming') return task.dueDate > todayISO;
    return true;
  });
}
