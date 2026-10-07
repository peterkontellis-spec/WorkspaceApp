/** Calendar date in the viewer's timezone; due dates remain calendar dates, not instants. */
export function localDateKey(date = new Date(), timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function activeUniqueTasks(tasks) {
  const seen = new Set();
  return tasks.filter((task) => {
    if (task.archivedAt || task.boardArchived || seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

function dueBucket(task, todayISO) {
  if (!task.dueDate) return 'undated';
  if (task.dueDate < todayISO) return 'overdue';
  if (task.dueDate === todayISO) return 'today';
  return 'upcoming';
}

export function dashboardSummary(tasks, todayISO) {
  const summary = {
    total: 0,
    open: 0,
    done: 0,
    toDo: 0,
    inProgress: 0,
    overdue: 0,
    today: 0,
    upcoming: 0,
    undated: 0,
    completionPercent: null,
  };
  for (const task of activeUniqueTasks(tasks)) {
    summary.total += 1;
    if (task.status === 'Done') {
      summary.done += 1;
    } else {
      summary.open += 1;
      if (task.status === 'To do') summary.toDo += 1;
      if (task.status === 'In progress') summary.inProgress += 1;
      summary[dueBucket(task, todayISO)] += 1;
    }
  }
  if (summary.total) summary.completionPercent = Math.round((summary.done / summary.total) * 100);
  return summary;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareDue(left, right) {
  return (
    compareText(left.dueDate || '9999-99-99', right.dueDate || '9999-99-99') ||
    left.title.localeCompare(right.title, 'en') ||
    compareText(left.id, right.id)
  );
}

/** Derive all dashboards from the same already-authorized shared work snapshot. */
export function buildWorkDashboard(snapshot, todayISO) {
  const boards = snapshot.boards.filter((board) => !board.archivedAt);
  const boardIds = new Set(boards.map((board) => board.id));
  const tasks = activeUniqueTasks(snapshot.tasks).filter((task) => boardIds.has(task.boardId));
  const memberIds = new Set(snapshot.members.map((member) => member.id));
  const unavailableAssigneeTasks = tasks
    .filter((task) => task.assigneeIds.length > 0 && !task.assigneeIds.some((id) => memberIds.has(id)))
    .sort(compareDue);
  const personalTasks = tasks.filter((task) => task.assigneeIds.includes(snapshot.actor.id));
  const personalBuckets = { overdue: [], today: [], upcoming: [], undated: [] };
  for (const task of personalTasks) {
    if (task.status !== 'Done') personalBuckets[dueBucket(task, todayISO)].push(task);
  }
  Object.values(personalBuckets).forEach((bucket) => bucket.sort(compareDue));
  const recentTasks = personalTasks
    .filter((task) => task.updatedAt && Number.isFinite(Date.parse(task.updatedAt)))
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || compareText(left.id, right.id),
    )
    .slice(0, 5);
  return {
    personal: dashboardSummary(personalTasks, todayISO),
    team: dashboardSummary(tasks, todayISO),
    personalTasks,
    personalBuckets,
    overdueTasks: tasks
      .filter((task) => task.status !== 'Done' && dueBucket(task, todayISO) === 'overdue')
      .sort(compareDue),
    boards: boards.map((board) => ({
      board,
      summary: dashboardSummary(
        tasks.filter((task) => task.boardId === board.id),
        todayISO,
      ),
    })),
    members: snapshot.members.map((member) => ({
      member,
      summary: dashboardSummary(
        tasks.filter((task) => task.assigneeIds.includes(member.id)),
        todayISO,
      ),
    })),
    unassigned: dashboardSummary(
      tasks.filter((task) => task.assigneeIds.length === 0),
      todayISO,
    ),
    unavailableAssignees: dashboardSummary(unavailableAssigneeTasks, todayISO),
    unavailableAssigneeTasks,
    recentTasks,
  };
}
