import {
  boards,
  DEMO_DATE,
  documents as documentFixtures,
  members,
  tasks as taskFixtures,
  type Status,
  type Task,
} from '@/lib/demo';

export type DemoTask = Task & {
  notes: string;
  checklist: { id: string; text: string; done: boolean }[];
  subtasks: { id: string; title: string; status: Status }[];
  attachments: { id: string; name: string; size: string }[];
};

export type DemoDocument = {
  id: string;
  title: string;
  boardId: string;
  description: string;
  updated: string;
  body: string;
};

export type DemoState = { tasks: DemoTask[]; documents: DemoDocument[] };
export type TaskMutation = { state: DemoState; error: string | null; taskId?: string };
export const taskGroups = ['This week', 'Next', 'Completed'] as const;
export const taskStatuses: Status[] = ['To do', 'In progress', 'Done'];
export const taskPriorities: Task['priority'][] = ['High', 'Medium', 'Low'];

const initialBodies: Record<string, string> = {
  'launch-brief':
    '# Launch brief\n\n## Purpose\nGive visitors a clearer introduction to our work and a straightforward next step.\n\n## Scope\n- Homepage direction\n- About page content\n- Responsive layouts\n\n## Next steps\nReview the direction together, then agree the first pages to draft.',
  'content-outline':
    '# Content outline\n\n## Homepage\nA short introduction, our work, and a clear way to get in touch.\n\n## About\nWho we are, how we work, and the things we care about.\n\n## References\nCollect useful examples and explain what each one helps us communicate.',
  'weekly-notes':
    '# Weekly notes\n\n## This week\nReview shared folders and agree the next priorities.\n\n## Decisions\nKeep the first release focused on the core workspace journey.\n\n## Next steps\nPrepare the catch-up and update the handover notes.',
};

export function createDemoState(): DemoState {
  return {
    tasks: taskFixtures.map((task) => ({
      ...task,
      assigneeIds: [...task.assigneeIds],
      notes:
        task.id === 't1' ? 'Bring together the goals, scope, and open questions before the team review.' : '',
      checklist:
        task.id === 't1'
          ? [
              { id: 'c1', text: 'Agree the launch goals', done: true },
              { id: 'c2', text: 'Confirm the first release scope', done: false },
            ]
          : [],
      subtasks:
        task.id === 't1' ? [{ id: 's1', title: 'Gather feedback from the team', status: 'To do' }] : [],
      attachments: task.id === 't1' ? [{ id: 'a1', name: 'Launch references.pdf', size: '240 KB' }] : [],
    })),
    documents: documentFixtures.map(({ id, title, boardId, description, updated }) => ({
      id,
      title,
      boardId,
      description,
      updated,
      body: initialBodies[id] ?? `# ${title}\n`,
    })),
  };
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasUniqueIds(items: { id: string }[]): boolean {
  return (
    items.every((item) => item && typeof item.id === 'string' && item.id.trim().length > 0) &&
    new Set(items.map((item) => item.id)).size === items.length
  );
}

export function validateTaskPatch(state: DemoState, id: string, patch: Partial<DemoTask>): string | null {
  const existing = state.tasks.find((task) => task.id === id);
  if (!existing) return 'This task could not be found.';
  if ('id' in patch && patch.id !== existing.id) return 'A task’s ID cannot be changed.';
  if ('boardId' in patch && patch.boardId !== existing.boardId)
    return 'Moving tasks between boards is not available in this prototype.';
  const task = { ...existing, ...patch };
  if (typeof task.title !== 'string' || !task.title.trim()) return 'Enter a task title.';
  if (!taskStatuses.includes(task.status)) return 'Choose a valid status.';
  if (!taskGroups.includes(task.group)) return 'Choose a valid group.';
  if (!taskPriorities.includes(task.priority)) return 'Choose a valid priority.';
  if (task.dueDate !== null && !isValidDate(task.dueDate)) return 'Enter a valid due date.';
  if (
    !Array.isArray(task.assigneeIds) ||
    task.assigneeIds.some((memberId) => !members.some((member) => member.id === memberId))
  )
    return 'Choose an existing sample member.';
  if (
    task.documentId !== undefined &&
    !state.documents.some((document) => document.id === task.documentId && document.boardId === task.boardId)
  )
    return 'Choose a document from this board.';
  if (typeof task.notes !== 'string') return 'Task notes must be text.';
  if (
    !Array.isArray(task.checklist) ||
    !hasUniqueIds(task.checklist) ||
    task.checklist.some(
      (item) => typeof item.text !== 'string' || !item.text.trim() || typeof item.done !== 'boolean',
    )
  )
    return 'Each checklist item needs a unique ID and text.';
  if (
    !Array.isArray(task.subtasks) ||
    !hasUniqueIds(task.subtasks) ||
    task.subtasks.some(
      (item) => typeof item.title !== 'string' || !item.title.trim() || !taskStatuses.includes(item.status),
    )
  )
    return 'Each subtask needs a unique ID, title, and valid status.';
  if (
    !Array.isArray(task.attachments) ||
    !hasUniqueIds(task.attachments) ||
    task.attachments.some(
      (item) => typeof item.name !== 'string' || !item.name.trim() || typeof item.size !== 'string',
    )
  )
    return 'Each sample file needs a unique ID, name, and size.';
  return null;
}

export function patchDemoTask(state: DemoState, id: string, patch: Partial<DemoTask>): TaskMutation {
  const error = validateTaskPatch(state, id, patch);
  if (error) return { state, error };
  return {
    state: {
      ...state,
      tasks: state.tasks.map((task) => {
        if (task.id !== id) return task;
        const updated = { ...task, ...patch };
        return {
          ...updated,
          title: updated.title.trim(),
          assigneeIds: [...new Set(updated.assigneeIds)],
          checklist: updated.checklist.map((item) => ({ ...item, text: item.text.trim() })),
          subtasks: updated.subtasks.map((item) => ({ ...item, title: item.title.trim() })),
          attachments: updated.attachments.map((item) => ({ ...item })),
        };
      }),
    },
    error: null,
  };
}

export function addDemoTask(
  state: DemoState,
  boardId: string,
  group: Task['group'],
  title: string,
): TaskMutation {
  if (!boards.some((board) => board.id === boardId)) return { state, error: 'Choose an existing board.' };
  if (!taskGroups.includes(group)) return { state, error: 'Choose a valid group.' };
  if (typeof title !== 'string' || !title.trim()) return { state, error: 'Enter a task title.' };
  let number = state.tasks.length + 1;
  while (state.tasks.some((task) => task.id === `t${number}`)) number += 1;
  const task: DemoTask = {
    id: `t${number}`,
    title: title.trim(),
    boardId,
    group,
    status: 'To do',
    priority: 'Medium',
    assigneeIds: [],
    dueDate: null,
    notes: '',
    checklist: [],
    subtasks: [],
    attachments: [],
  };
  return { state: { ...state, tasks: [...state.tasks, task] }, error: null, taskId: task.id };
}

export function patchDemoDocument(state: DemoState, id: string, patch: Partial<DemoDocument>): DemoState {
  const document = state.documents.find((item) => item.id === id);
  if (!document) return state;
  const updated = {
    ...document,
    title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : document.title,
    description: typeof patch.description === 'string' ? patch.description : document.description,
    body: typeof patch.body === 'string' ? patch.body : document.body,
    updated: 'This session',
  };
  // Identity stays fixed; putting the edited record first gives Home real session recency.
  return { ...state, documents: [updated, ...state.documents.filter((item) => item.id !== id)] };
}

export function getPersonalBuckets(tasks: DemoTask[], memberId: string, today = DEMO_DATE) {
  if (!isValidDate(today)) throw new Error('Personal buckets require a valid reference date.');
  const buckets: { overdue: DemoTask[]; today: DemoTask[]; upcoming: DemoTask[]; undated: DemoTask[] } = {
    overdue: [],
    today: [],
    upcoming: [],
    undated: [],
  };
  for (const task of tasks) {
    if (task.status === 'Done' || !task.assigneeIds.includes(memberId)) continue;
    if (!task.dueDate) buckets.undated.push(task);
    else if (task.dueDate < today) buckets.overdue.push(task);
    else if (task.dueDate === today) buckets.today.push(task);
    else buckets.upcoming.push(task);
  }
  for (const bucket of Object.values(buckets))
    bucket.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.title.localeCompare(b.title));
  return buckets;
}

export type BoardFilters = {
  query?: string;
  status?: Status | 'all';
  assigneeId?: string;
  priority?: Task['priority'] | 'all';
};

export function filterBoardTasks(tasks: DemoTask[], boardId: string, filters: BoardFilters = {}) {
  const query = (filters.query ?? '').trim().toLocaleLowerCase();
  return tasks.filter(
    (task) =>
      task.boardId === boardId &&
      (!query ||
        task.title.toLocaleLowerCase().includes(query) ||
        task.notes.toLocaleLowerCase().includes(query)) &&
      (!filters.status || filters.status === 'all' || task.status === filters.status) &&
      (!filters.priority || filters.priority === 'all' || task.priority === filters.priority) &&
      (!filters.assigneeId ||
        filters.assigneeId === 'all' ||
        (filters.assigneeId === 'unassigned'
          ? task.assigneeIds.length === 0
          : task.assigneeIds.includes(filters.assigneeId))),
  );
}
