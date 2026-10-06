export type WorkRole = 'owner' | 'editor' | 'viewer';
export type WorkBoard = { id: string; name: string; description: string; revision: number };
export type WorkGroup = { id: string; boardId: string; name: string; position: number; revision: number };
export type WorkTask = { id: string; boardId: string; groupId: string; parentId: string | null; title: string; status: 'To do' | 'In progress' | 'Done'; priority: 'Low' | 'Medium' | 'High'; dueDate: string | null; position: number; revision: number; assigneeIds: string[] };
export type WorkMember = { id: string; name: string; email: string; role: WorkRole };
export type WorkSnapshot = { boards: WorkBoard[]; groups: WorkGroup[]; tasks: WorkTask[]; members: WorkMember[]; actor: { id: string; name: string; role: WorkRole } };
export function localToday() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function workDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)) : 'No date'; }
