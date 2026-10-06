export type InlineToken =
  { kind: 'text' | 'bold' | 'italic'; text: string } | { kind: 'link'; text: string; href: string };
export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };
export type TextEdit = { text: string; start: number; end: number };

export function safeLinkUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /[\s\\\u0000-\u001f\u007f]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // This deliberately small subset yields text tokens, never HTML or executable markup.
  const pattern = /\\(.)|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    if (index > end) tokens.push({ kind: 'text', text: text.slice(end, index) });
    if (match[1]) tokens.push({ kind: 'text', text: match[1] });
    else if (match[2]) {
      const href = safeLinkUrl(match[3]);
      tokens.push(href ? { kind: 'link', text: match[2], href } : { kind: 'text', text: match[0] });
    } else if (match[4]) tokens.push({ kind: 'bold', text: match[4] });
    else tokens.push({ kind: 'italic', text: match[5] });
    end = index + match[0].length;
  }
  if (end < text.length) tokens.push({ kind: 'text', text: text.slice(end) });
  return tokens;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) {
      blocks.push({ kind: 'paragraph', text: '' });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const list = /^\s*[-+*]\s+(.+)$/.exec(line);
    if (heading) blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
    else if (list) {
      const previous = blocks.at(-1);
      if (previous?.kind === 'list') previous.items.push(list[1]);
      else blocks.push({ kind: 'list', items: [list[1]] });
    } else {
      const previous = blocks.at(-1);
      if (previous?.kind === 'paragraph' && previous.text) previous.text += `\n${line}`;
      else blocks.push({ kind: 'paragraph', text: line });
    }
  }
  return blocks.filter((block) => block.kind !== 'paragraph' || block.text !== '');
}

function selection(text: string, start: number, end: number) {
  const first = Math.max(0, Math.min(text.length, Number.isFinite(start) ? start : 0));
  const last = Math.max(first, Math.min(text.length, Number.isFinite(end) ? end : first));
  return { first, last };
}

export function formatSelection(
  text: string,
  start: number,
  end: number,
  format: 'heading' | 'bold' | 'italic' | 'list',
): TextEdit {
  const { first, last } = selection(text, start, end);
  if (format === 'heading' || format === 'list') {
    const lineStart = first === 0 ? 0 : text.lastIndexOf('\n', first - 1) + 1;
    const selectedEnd = last > first && text[last - 1] === '\n' ? last - 1 : last;
    const nextNewline = text.indexOf('\n', selectedEnd);
    const lineEnd = nextNewline === -1 ? text.length : nextNewline;
    const prefix = format === 'heading' ? '## ' : '- ';
    const contents = text.slice(lineStart, lineEnd) || (format === 'heading' ? 'Heading' : 'List item');
    const replacement = contents
      .split('\n')
      .map((line) => `${prefix}${line.replace(/^(?:#{1,6}\s+|[-+*]\s+)/, '')}`)
      .join('\n');
    return {
      text: text.slice(0, lineStart) + replacement + text.slice(lineEnd),
      start: lineStart,
      end: lineStart + replacement.length,
    };
  }
  const marker = format === 'bold' ? '**' : '*';
  const content = text.slice(first, last) || (format === 'bold' ? 'Bold text' : 'Italic text');
  return {
    text: text.slice(0, first) + marker + content + marker + text.slice(last),
    start: first + marker.length,
    end: first + marker.length + content.length,
  };
}

export function insertLink(
  text: string,
  start: number,
  end: number,
  label: string,
  url: string,
): TextEdit | null {
  const href = safeLinkUrl(url);
  const cleanLabel = label.trim();
  if (!href || !cleanLabel || /[\[\]\\\r\n]/.test(cleanLabel)) return null;
  const { first, last } = selection(text, start, end);
  const replacement = `[${cleanLabel}](${href.replaceAll('(', '%28').replaceAll(')', '%29')})`;
  return {
    text: text.slice(0, first) + replacement + text.slice(last),
    start: first + 1,
    end: first + 1 + cleanLabel.length,
  };
}
