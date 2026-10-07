export type WorkTemplate = {
  id: string;
  name: string;
  kind: 'task' | 'board';
  revision: number;
  taskCount: number;
  groupCount: number;
  columnCount: number;
  createdBy: string;
  createdAt: string;
};
export type TemplateLibrary = {
  templates: WorkTemplate[];
  archivedTemplates: WorkTemplate[];
  actor: { id: string; role: 'owner' | 'editor' | 'viewer' };
};
export type TemplateResult = { boardId?: string; taskId?: string; template?: WorkTemplate };
