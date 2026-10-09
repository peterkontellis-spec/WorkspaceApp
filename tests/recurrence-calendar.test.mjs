import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validDate, localDate, occurrenceDate, calendarWindow } from '../src/server/recurrence-calendar.mjs';

test('monthly intervals clamp to month end without losing their original anchor', () => {
  assert.equal(occurrenceDate('2028-01-31', 'month', 1, 1), '2028-02-29');
  assert.equal(occurrenceDate('2028-01-31', 'month', 1, 2), '2028-03-31');
  assert.equal(occurrenceDate('2027-01-31', 'month', 1, 1), '2027-02-28');
  assert.equal(occurrenceDate('2028-02-29', 'month', 12, 1), '2029-02-28');
  assert.equal(occurrenceDate('2028-02-29', 'month', 12, 4), '2032-02-29');
  assert.equal(occurrenceDate('2028-01-31', 'month', 2, 2), '2028-05-31');
});
test('daily/weekly arithmetic preserves date-only meaning across year and DST transitions', () => {
  assert.equal(occurrenceDate('2028-12-31', 'day', 2), '2029-01-02');
  assert.equal(occurrenceDate('2030-03-30', 'day', 1), '2030-03-31');
  assert.equal(occurrenceDate('2030-10-26', 'week', 2), '2030-11-09');
  assert.equal(occurrenceDate('0099-12-31', 'day', 1), '0100-01-01');
});
test('latest and future windows jump long downtime directly and respect month clamping', () => {
  assert.deepEqual(calendarWindow('2028-01-31', 'month', 1, '2028-02-28'), { latestIndex: 0, nextIndex: 1 });
  assert.deepEqual(calendarWindow('2028-01-31', 'month', 1, '2028-02-29'), { latestIndex: 1, nextIndex: 2 });
  assert.deepEqual(calendarWindow('2028-01-31', 'month', 1, '2028-03-30'), { latestIndex: 1, nextIndex: 2 });
  assert.deepEqual(calendarWindow('2030-01-01', 'day', 1, '2029-01-01'), { latestIndex: null, nextIndex: 0 });
  assert.deepEqual(calendarWindow('2000-01-01', 'day', 1, '2030-01-01'), {
    latestIndex: 10958,
    nextIndex: 10959,
  });
});
test('named timezone local dates cross midnight correctly on spring/fall DST and differ by zone', () => {
  assert.equal(localDate('2030-03-31T21:30:00Z', 'Europe/Athens'), '2030-04-01');
  assert.equal(localDate('2030-10-27T21:30:00Z', 'Europe/Athens'), '2030-10-27');
  assert.equal(localDate('2030-01-01T01:00:00Z', 'America/New_York'), '2029-12-31');
  assert.equal(localDate('2030-01-01T01:00:00Z', 'Asia/Tokyo'), '2030-01-01');
});
test('invalid dates, unsupported units, excessive intervals and calendar overflow reject', () => {
  for (const date of ['2027-02-29', '2028-02-30', '0000-01-01', '2030-1-01', null, 42])
    assert.equal(validDate(date), false);
  for (const interval of [0, -1, 1.5, 366, '1'])
    assert.throws(() => occurrenceDate('2030-01-01', 'day', interval));
  assert.throws(() => occurrenceDate('2030-01-01', 'year', 1));
  assert.throws(() => occurrenceDate('9999-12-31', 'day', 1));
  assert.throws(() => calendarWindow('2030-01-01', 'month', 1, 'bad'));
});
