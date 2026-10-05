export type Section = 'home' | 'boards' | 'docs';
export type Status = 'In progress' | 'To do' | 'Done';

export type Member = {
  id: string;
  name: string;
  initials: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  color: 'teal' | 'purple' | 'peach' | 'blue';
};

export type Task = {
  id: string;
  title: string;
  boardId: string;
  group: 'This week' | 'Next' | 'Completed';
  status: Status;
  assigneeIds: string[];
  dueDate: string | null;
  priority: 'High' | 'Medium' | 'Low';
  documentId?: string;
};

export const DEMO_DATE = '2026-09-25';
export const members: Member[] = [
  { id: 'alex', name: 'Alex Morgan', initials: 'AM', role: 'Owner', color: 'teal' },
  { id: 'sam', name: 'Sam Taylor', initials: 'ST', role: 'Editor', color: 'purple' },
  { id: 'robin', name: 'Robin Ellis', initials: 'RE', role: 'Editor', color: 'peach' },
  { id: 'casey', name: 'Casey Blake', initials: 'CB', role: 'Viewer', color: 'blue' },
];

export const boards = [
  { id: 'website-refresh', name: 'Website refresh', description: 'A clearer home for our next chapter.', color: 'teal', icon: 'layout', memberIds: ['alex', 'sam', 'robin'] },
  { id: 'team-operations', name: 'Team operations', description: 'The everyday details that keep us moving.', color: 'purple', icon: 'layers', memberIds: ['alex', 'sam', 'robin', 'casey'] },
] as const;

export const documents = [
  { id: 'launch-brief', title: 'Launch brief', boardId: 'website-refresh', description: 'Goals, scope, and the story we want to tell.', updated: '25 Sep', authorId: 'alex' },
  { id: 'content-outline', title: 'Content outline', boardId: 'website-refresh', description: 'A shared starting point for the new pages.', updated: '24 Sep', authorId: 'sam' },
  { id: 'weekly-notes', title: 'Weekly notes', boardId: 'team-operations', description: 'Decisions and next steps for the week.', updated: '23 Sep', authorId: 'robin' },
];

export const tasks: Task[] = [
  { id: 't1', title: 'Prepare launch brief', boardId: 'website-refresh', group: 'This week', status: 'In progress', assigneeIds: ['alex', 'sam'], dueDate: '2026-09-25', priority: 'High', documentId: 'launch-brief' },
  { id: 't2', title: 'Review the homepage direction', boardId: 'website-refresh', group: 'This week', status: 'To do', assigneeIds: ['alex'], dueDate: '2026-09-25', priority: 'Medium' },
  { id: 't3', title: 'Gather content references', boardId: 'website-refresh', group: 'This week', status: 'In progress', assigneeIds: ['sam'], dueDate: '2026-09-24', priority: 'Medium', documentId: 'content-outline' },
  { id: 't4', title: 'Draft the about page', boardId: 'website-refresh', group: 'Next', status: 'To do', assigneeIds: ['robin'], dueDate: '2026-09-28', priority: 'Low' },
  { id: 't5', title: 'Check the mobile layouts', boardId: 'website-refresh', group: 'Next', status: 'To do', assigneeIds: [], dueDate: null, priority: 'Medium' },
  { id: 't6', title: 'Collect the project requirements', boardId: 'website-refresh', group: 'Completed', status: 'Done', assigneeIds: ['alex'], dueDate: '2026-09-22', priority: 'High' },
  { id: 't7', title: 'Outline next week’s priorities', boardId: 'team-operations', group: 'This week', status: 'To do', assigneeIds: ['alex'], dueDate: '2026-09-25', priority: 'Medium', documentId: 'weekly-notes' },
  { id: 't8', title: 'Review shared folders', boardId: 'team-operations', group: 'This week', status: 'In progress', assigneeIds: ['casey', 'robin'], dueDate: '2026-09-24', priority: 'Low' },
  { id: 't9', title: 'Prepare the weekly catch-up', boardId: 'team-operations', group: 'Next', status: 'To do', assigneeIds: ['sam'], dueDate: '2026-09-28', priority: 'Medium' },
  { id: 't10', title: 'Update the handover notes', boardId: 'team-operations', group: 'Next', status: 'To do', assigneeIds: ['robin'], dueDate: '2026-09-29', priority: 'Low' },
  { id: 't11', title: 'Confirm project ownership', boardId: 'team-operations', group: 'Completed', status: 'Done', assigneeIds: ['alex', 'sam'], dueDate: '2026-09-23', priority: 'High' },
  { id: 't12', title: 'Plan the next team session', boardId: 'team-operations', group: 'Next', status: 'To do', assigneeIds: [], dueDate: null, priority: 'Low' },
];

export function boardFor(id: string) {
  return boards.find((board) => board.id === id);
}

export function formatDue(date: string | null) {
  if (!date) return 'No date';
  if (date === DEMO_DATE) return 'Today';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
