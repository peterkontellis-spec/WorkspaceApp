import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/markdown.ts', import.meta.url), 'utf8');
const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { safeLinkUrl, parseInline, parseMarkdown, formatSelection, insertLink } = await import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString('base64')}`);

test('preview only allows absolute HTTP(S) links without concealed schemes', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'vbscript:x', 'file:///tmp/test', '//example.com', '/relative', 'https:\\example.com', 'https://exa\nmple.com', 'https://user:pass@example.com', 'https://example.com/a b']) assert.equal(safeLinkUrl(value), null, value);
  assert.equal(safeLinkUrl(' https://example.com/path?q=1 '), 'https://example.com/path?q=1');
  assert.equal(safeLinkUrl('HTTP://example.com'), 'http://example.com/');
});

test('raw HTML and unsafe links remain inert text; basic inline formatting produces typed tokens', () => {
  const tokens = parseInline('<img src=x onerror=alert(1)> [bad](javascript:evil) **strong** *soft* [site](https://example.com)');
  assert.deepEqual(tokens.filter((token) => token.kind === 'link'), [{ kind: 'link', text: 'site', href: 'https://example.com/' }]);
  assert.equal(tokens[0].text, '<img src=x onerror=alert(1)> ');
  assert.equal(tokens[1].text, '[bad](javascript:evil)');
  assert.ok(tokens.some((token) => token.kind === 'bold' && token.text === 'strong'));
  assert.ok(tokens.some((token) => token.kind === 'italic' && token.text === 'soft'));
  assert.equal(parseInline('\\*literal\\*').map((token) => token.text).join(''), '*literal*');
});

test('block parsing handles headings, paragraphs, lists, Windows newlines and empty documents', () => {
  assert.deepEqual(parseMarkdown(' \n\r\n'), []);
  assert.deepEqual(parseMarkdown('# Title\r\n\r\nFirst line\r\nSecond line\r\n\r\n- One\r\n- Two'), [
    { kind: 'heading', level: 1, text: 'Title' }, { kind: 'paragraph', text: 'First line\nSecond line' }, { kind: 'list', items: ['One', 'Two'] },
  ]);
});

test('formatting wraps selected text and places selection inside inserted markers', () => {
  assert.deepEqual(formatSelection('A clear brief', 2, 7, 'bold'), { text: 'A **clear** brief', start: 4, end: 9 });
  assert.deepEqual(formatSelection('', 0, 0, 'italic'), { text: '*Italic text*', start: 1, end: 12 });
  assert.equal(formatSelection('One\nTwo\nThree', 0, 8, 'list').text, '- One\n- Two\nThree');
  assert.equal(formatSelection('First\nSecond', 8, 8, 'heading').text, 'First\n## Second');
  assert.equal(formatSelection('', -10, 999, 'heading').text, '## Heading');
  assert.equal(formatSelection('\nSecond line', 0, 0, 'heading').text, '## Heading\nSecond line');
});

test('link insertion validates labels and URL, preserves surrounding text, and encodes parentheses', () => {
  const edit = insertLink('Read this now', 5, 9, 'the guide', 'https://example.com/a(b)');
  assert.equal(edit.text, 'Read [the guide](https://example.com/a%28b%29) now');
  assert.equal(edit.text.slice(edit.start, edit.end), 'the guide');
  const link = parseInline(edit.text).find((token) => token.kind === 'link');
  assert.equal(link.href, 'https://example.com/a%28b%29');
  assert.equal(insertLink('', 0, 0, '', 'https://example.com'), null);
  assert.equal(insertLink('', 0, 0, '[injection]', 'https://example.com'), null);
  assert.equal(insertLink('', 0, 0, 'Link', 'javascript:alert(1)'), null);
});
