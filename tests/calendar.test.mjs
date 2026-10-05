import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/calendar.ts', import.meta.url), 'utf8');
const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { calendarDate, calendarCells, moveCalendarDate, moveCalendarMonth } = await import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString('base64')}`);

test('calendar rejects impossible dates and handles leap years', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '25/09/2026', '']) assert.equal(calendarDate(date), null);
  assert.ok(calendarDate('2028-02-29'));
  const leap = calendarCells('2028-02-01').filter(Boolean);
  assert.equal(leap.length, 29);
  assert.equal(leap.at(-1), '2028-02-29');
});

test('calendar places dates in Monday-first full weeks without adjacent-month selections', () => {
  const cells = calendarCells('2026-09-25');
  assert.equal(cells[0], null);
  assert.equal(cells[1], '2026-09-01');
  assert.equal(cells.filter(Boolean).length, 30);
  assert.equal(cells.length % 7, 0);
  assert.equal(new Set(cells.filter(Boolean)).size, 30);
});

test('keyboard movement crosses months and years, clamps short months, and ignores DST', () => {
  assert.equal(moveCalendarDate('2026-12-31', 1), '2027-01-01');
  assert.equal(moveCalendarDate('2026-03-01', -1), '2026-02-28');
  assert.equal(moveCalendarDate('2026-03-28', 2), '2026-03-30');
  assert.equal(moveCalendarMonth('2028-01-31', 1), '2028-02-29');
  assert.equal(moveCalendarMonth('2026-03-31', -1), '2026-02-28');
  assert.equal(moveCalendarMonth('2026-01-15', -1), '2025-12-15');
});
