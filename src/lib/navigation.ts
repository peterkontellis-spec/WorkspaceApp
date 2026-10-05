export function safeReturnPath(value: string | null): string | null {
  if (!value) return null;
  const [path] = value.split('?');
  return /^\/(home|boards(?:\/[a-z0-9-]+)?)$/.test(path) ? value : null;
}

export function updateTaskQuery(pathname: string, query: string, taskId: string | null): string {
  const next = new URLSearchParams(query);
  if (taskId) next.set('task', taskId);
  else next.delete('task');
  return pathname + (next.size ? `?${next}` : '');
}
