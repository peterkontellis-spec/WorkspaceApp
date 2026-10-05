import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

function moduleUrl(source, fileName) {
  const { outputText } = ts.transpileModule(source, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const linked = outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  return `data:text/javascript;base64,${Buffer.from(linked).toString('base64')}`;
}
const parserUrl = moduleUrl(await readFile(new URL('../src/lib/markdown.ts', import.meta.url), 'utf8'), 'markdown.ts');
const source = (await readFile(new URL('../src/components/markdown-preview.tsx', import.meta.url), 'utf8')).replaceAll("'@/lib/markdown'", JSON.stringify(parserUrl));
const { MarkdownPreview } = await import(moduleUrl(source, 'markdown-preview.tsx'));

test('a link inserted into bold or italic text renders as a usable link', () => {
  const html = renderToStaticMarkup(createElement(MarkdownPreview, { body: '**[Review text](https://example.com/)** and *[Guide](https://example.com/guide)*' }));
  assert.match(html, /<strong><a href="https:\/\/example.com\/"/);
  assert.match(html, /<em><a href="https:\/\/example.com\/guide"/);
  assert.doesNotMatch(html, /\[Review text\]/);
});

test('empty previews explain recovery and nested formatting cannot execute HTML or unsafe URLs', () => {
  assert.match(renderToStaticMarkup(createElement(MarkdownPreview, { body: ' \n ' })), /Your document is empty/);
  const html = renderToStaticMarkup(createElement(MarkdownPreview, { body: '**<script>alert(1)</script> [bad](javascript:evil)**' }));
  assert.doesNotMatch(html, /<script|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
});
