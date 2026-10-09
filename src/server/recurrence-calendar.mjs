const dayMs = 86_400_000;
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const instant = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}
export function localDate(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const get = (key) => parts.find((p) => p.type === key).value;
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}
export function occurrenceDate(anchor, unit, interval, index = 1) {
  if (
    !validDate(anchor) ||
    !['day', 'week', 'month'].includes(unit) ||
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 365 ||
    !Number.isSafeInteger(index) ||
    index < 0
  )
    throw new Error('Invalid recurrence calendar input.');
  const date = new Date(`${anchor}T00:00:00Z`);
  if (unit === 'month') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + interval * index);
    const end = new Date(date);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    date.setUTCDate(Math.min(day, end.getUTCDate()));
  } else date.setUTCDate(date.getUTCDate() + interval * index * (unit === 'week' ? 7 : 1));
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999 || date.getUTCFullYear() < 1)
    throw new Error('Recurrence exceeds supported calendar dates.');
  return date.toISOString().slice(0, 10);
}
// O(1) arithmetic with at most one boundary adjustment; long downtime never
// loops over every missed day. Monthly occurrences always use the original day.
export function calendarWindow(anchor, unit, interval, today) {
  if (!validDate(today)) throw new Error('Invalid recurrence calendar date.');
  occurrenceDate(anchor, unit, interval, 0);
  if (today < anchor) return { latestIndex: null, nextIndex: 0 };
  const from = new Date(`${anchor}T00:00:00Z`),
    to = new Date(`${today}T00:00:00Z`);
  let latestIndex =
    unit === 'month'
      ? Math.floor(
          ((to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth()) /
            interval,
        )
      : Math.floor((to - from) / dayMs / (interval * (unit === 'week' ? 7 : 1)));
  if (occurrenceDate(anchor, unit, interval, latestIndex) > today) latestIndex--;
  return { latestIndex, nextIndex: latestIndex + 1 };
}
