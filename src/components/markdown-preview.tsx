import { parseInline, parseMarkdown } from '@/lib/markdown';

function InlineText({ text, depth = 0 }: { text: string; depth?: number }) {
  if (depth >= 8) return text;
  return parseInline(text).map((token, index) => token.kind === 'bold' ? <strong key={index}><InlineText text={token.text} depth={depth + 1} /></strong> : token.kind === 'italic' ? <em key={index}><InlineText text={token.text} depth={depth + 1} /></em> : token.kind === 'link' ? <a key={index} href={token.href} target="_blank" rel="noopener noreferrer">{token.text}<span className="sr-only"> (opens in a new tab)</span></a> : token.text);
}

export function MarkdownPreview({ body }: { body: string }) {
  if (!body.trim()) return <div className="docs-empty"><h2>Your document is empty.</h2><p>Choose Write to start a note, brief, or outline.</p></div>;
  return <div className="docs-prose">{parseMarkdown(body).map((block, index) => {
    if (block.kind === 'list') return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText text={item} /></li>)}</ul>;
    if (block.kind === 'paragraph') return <p key={index}><InlineText text={block.text} /></p>;
    const Heading = `h${Math.min(6, block.level + 1)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return <Heading key={index}><InlineText text={block.text} /></Heading>;
  })}</div>;
}

