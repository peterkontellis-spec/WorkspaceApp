import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/keyboard-visibility.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { isSoftwareKeyboardOpen } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const phone = { narrow: true, editing: true, layoutHeight: 800, visibleHeight: 480, scale: 1 };

test('phone software keyboard hides navigation and dismissal restores it even with input focused', () => {
  assert.equal(isSoftwareKeyboardOpen(phone), true);
  assert.equal(isSoftwareKeyboardOpen({ ...phone, visibleHeight: 800 }), false);
});

test('toolbars, hardware-keyboard focus and a short viewport do not hide navigation', () => {
  assert.equal(isSoftwareKeyboardOpen({ ...phone, visibleHeight: 720 }), false);
  assert.equal(isSoftwareKeyboardOpen({ ...phone, layoutHeight: 480 }), false);
  assert.equal(isSoftwareKeyboardOpen({ ...phone, editing: false }), false);
  assert.equal(isSoftwareKeyboardOpen({ ...phone, narrow: false }), false);
});

test('pinch zoom is not mistaken for a keyboard, but keyboard plus zoom remains detectable', () => {
  assert.equal(isSoftwareKeyboardOpen({ ...phone, visibleHeight: 400, scale: 2 }), false);
  assert.equal(isSoftwareKeyboardOpen({ ...phone, visibleHeight: 240, scale: 2 }), true);
});
