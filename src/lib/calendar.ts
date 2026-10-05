// UTC keeps date-only values stable across time zones and daylight-saving changes.
export function calendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function moveCalendarDate(value: string, days: number): string {
  const date = calendarDate(value);
  if (!date) throw new Error('Invalid calendar date');
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  return /^\d{4}-/.test(result) ? result : value;
}

export function moveCalendarMonth(value: string, offset: number): string {
  const date = calendarDate(value);
  if (!date) throw new Error('Invalid calendar date');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const month = date.toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return value;
  const last = new Date(date);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  return `${month}-${String(Math.min(day, last.getUTCDate())).padStart(2, '0')}`;
}

export function calendarCells(value: string): (string | null)[] {
  const first = calendarDate(`${value.slice(0, 7)}-01`);
  if (!first) throw new Error('Invalid calendar month');
  const month = first.getUTCMonth();
  const cells: (string | null)[] = Array((first.getUTCDay() + 6) % 7).fill(null);
  while (first.getUTCMonth() === month) {
    cells.push(first.toISOString().slice(0, 10));
    first.setUTCDate(first.getUTCDate() + 1);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
