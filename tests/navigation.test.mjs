import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { safeReturnPath, updateTaskQuery } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

test('document return destinations stay inside Home or Boards', () => {
  for (const value of ['/home?task=t1', '/boards/website-refresh?status=Done&task=t1', '/boards']) assert.equal(safeReturnPath(value), value);
  for (const value of [null, '', 'https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', '/docs/launch-brief', '/boards/../outside', '/home/extra']) assert.equal(safeReturnPath(value), null);
});

test('opening and closing tasks preserves filters and collapsed groups', () => {
  const query = new URLSearchParams({ q: 'launch brief', status: 'In progress', collapsed: 'Next,Completed' }).toString();
  const opened = updateTaskQuery('/boards/website-refresh', query, 't1');
  const params = new URLSearchParams(opened.split('?')[1]);
  assert.equal(params.get('task'), 't1');
  assert.equal(params.get('q'), 'launch brief');
  assert.equal(params.get('collapsed'), 'Next,Completed');
  assert.equal(updateTaskQuery('/boards/website-refresh', params.toString(), null), `/boards/website-refresh?${query}`);
  assert.equal(updateTaskQuery('/home', 'task=t1', null), '/home');
});
