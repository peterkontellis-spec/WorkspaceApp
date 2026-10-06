'use client';

import Link from 'next/link';
import { useWork } from './work-provider';
import { useSearchParams } from 'next/navigation';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Bold, FileText, Heading2, Italic, Link2, List } from 'lucide-react';
import { boardFor } from '@/lib/demo';
import { formatSelection, insertLink, safeLinkUrl, type TextEdit } from '@/lib/markdown';
import { useWorkspace } from './demo-provider';
import { safeReturnPath } from './task-navigation';
import { Button, Panel } from './ui';
import './docs-view.css';
import { MarkdownPreview } from './markdown-preview';

function DocumentEditor({ id }: { id: string }) {
  const { documents, updateDocument } = useWorkspace();
  const params = useSearchParams();
  const { enabled: savedWork } = useWork();
  const returnTo = savedWork ? null : safeReturnPath(params.get('returnTo'));
  const doc = documents.find((document) => document.id === id);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const modeStartRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  useLayoutEffect(() => {
    if (!pendingSelection || !editorRef.current) return;
    editorRef.current.focus({ preventScroll: true });
    editorRef.current.setSelectionRange(pendingSelection.start, pendingSelection.end);
    selectionRef.current = pendingSelection;
    setPendingSelection(null);
  }, [pendingSelection, doc?.body]);

  if (!doc)
    return (
      <div className="empty-page">
        <h1>Document not found</h1>
        <p>Choose a document from the shared list.</p>
        <Link href="/docs" className="button">
          Back to Docs
        </Link>
      </div>
    );

  function applyEdit(edit: TextEdit) {
    updateDocument(id, { body: edit.text });
    setPendingSelection({ start: edit.start, end: edit.end });
  }
  function changeMode(next: 'write' | 'preview') {
    setMode(next);
    setLinkOpen(false);
    // Keep the selected view visible after the tall editor leaves the layout.
    requestAnimationFrame(() =>
      modeStartRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }),
    );
  }
  function format(kind: 'heading' | 'bold' | 'italic' | 'list') {
    if (doc) applyEdit(formatSelection(doc.body, selectionRef.current.start, selectionRef.current.end, kind));
  }
  function openLink() {
    setLinkText(doc!.body.slice(selectionRef.current.start, selectionRef.current.end));
    setLinkUrl('');
    setLinkError('');
    setLinkOpen(true);
  }
  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkText.trim() || /[\[\]\\\r\n]/.test(linkText)) {
      setLinkError('Enter link text without brackets, backslashes, or line breaks.');
      labelRef.current?.focus();
      return;
    }
    if (!safeLinkUrl(linkUrl)) {
      setLinkError('Enter a full http:// or https:// web address without spaces or sign-in details.');
      urlRef.current?.focus();
      return;
    }
    const result = insertLink(
      doc!.body,
      selectionRef.current.start,
      selectionRef.current.end,
      linkText,
      linkUrl,
    );
    if (result) {
      applyEdit(result);
      setLinkOpen(false);
      setLinkError('');
    }
  }

  return (
    <>
      <Link className="back-link" href={returnTo ?? '/docs'} scroll={!returnTo}>
        <ArrowLeft size={18} aria-hidden="true" />
        {returnTo ? 'Back to task' : 'Back to Docs'}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{doc.title}</h1>
          <p className="page-description">
            {boardFor(doc.boardId)?.name} · {doc.description}
          </p>
        </div>
      </div>
      <p className="session-note" id="docs-session-note">
        Session-only writing. Your changes stay while you navigate and reset when you refresh or close this
        page.
      </p>
      <Panel className="docs-editor" aria-label={`${doc.title} editor`}>
        <div ref={modeStartRef} className="docs-mode-start" aria-hidden="true" />
        <div className="docs-editor__top">
          <div className="docs-mode" role="group" aria-label="Document view">
            <Button aria-pressed={mode === 'write'} onClick={() => changeMode('write')}>
              Write
            </Button>
            <Button aria-pressed={mode === 'preview'} onClick={() => changeMode('preview')}>
              Preview
            </Button>
          </div>
          <span className="docs-editor__status">
            {doc.updated === 'This session' ? 'Edited in this session' : 'Sample document'}
          </span>
        </div>
        {mode === 'write' ? (
          <>
            <div className="docs-toolbar" role="group" aria-label="Insert formatting">
              <Button
                variant="ghost"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => format('heading')}
              >
                <Heading2 size={18} aria-hidden="true" />
                Heading
              </Button>
              <Button
                variant="ghost"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => format('bold')}
              >
                <Bold size={18} aria-hidden="true" />
                Bold
              </Button>
              <Button
                variant="ghost"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => format('italic')}
              >
                <Italic size={18} aria-hidden="true" />
                Italic
              </Button>
              <Button
                variant="ghost"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => format('list')}
              >
                <List size={18} aria-hidden="true" />
                List
              </Button>
              <Button
                variant="ghost"
                aria-expanded={linkOpen}
                aria-controls="docs-link-form"
                onClick={openLink}
              >
                <Link2 size={18} aria-hidden="true" />
                Link
              </Button>
            </div>
            {linkOpen && (
              <form className="docs-link-form" id="docs-link-form" noValidate onSubmit={submitLink}>
                <label>
                  Link text
                  <input
                    ref={labelRef}
                    name="link-text"
                    value={linkText}
                    onChange={(event) => setLinkText(event.target.value)}
                    autoComplete="off"
                    aria-describedby={linkError ? 'docs-link-error' : undefined}
                  />
                </label>
                <label>
                  Web address
                  <input
                    ref={urlRef}
                    name="link-url"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://example.com…"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    aria-describedby={linkError ? 'docs-link-error' : undefined}
                  />
                </label>
                {linkError && (
                  <p className="docs-link-error" id="docs-link-error" role="alert">
                    {linkError}
                  </p>
                )}
                <div className="docs-link-actions">
                  <Button type="submit" variant="primary">
                    Insert link
                  </Button>
                  <Button
                    onClick={() => {
                      setLinkOpen(false);
                      setPendingSelection(selectionRef.current);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            <div className="docs-writing">
              <label htmlFor="document-body">Document text</label>
              <p id="docs-format-help">
                Use the controls or type Markdown. Preview shows headings, bold, italic, lists, and web links.
              </p>
              <textarea
                id="document-body"
                name="document-body"
                ref={editorRef}
                value={doc.body}
                onChange={(event) => updateDocument(id, { body: event.target.value })}
                onSelect={(event) => {
                  selectionRef.current = {
                    start: event.currentTarget.selectionStart,
                    end: event.currentTarget.selectionEnd,
                  };
                }}
                aria-describedby="docs-format-help docs-session-note"
                placeholder="Start writing…"
                spellCheck
              />
            </div>
          </>
        ) : (
          <div className="docs-preview" aria-label="Document preview">
            <MarkdownPreview body={doc.body} />
          </div>
        )}
      </Panel>
    </>
  );
}

export function DocsView({ id }: { id?: string }) {
  const { documents } = useWorkspace();
  if (id) return <DocumentEditor key={id} id={id} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Docs</h1>
          <p className="page-description">Briefs, notes, and shared starting points.</p>
        </div>
      </div>
      <Panel className="docs-list">
        <div className="panel-heading">
          <h2>All documents</h2>
          <span className="section-count">{documents.length} sample docs</span>
        </div>
        {documents.map((doc) => (
          <Link key={doc.id} className="document-row" href={`/docs/${doc.id}`}>
            <span className="document-icon">
              <FileText size={22} aria-hidden="true" />
            </span>
            <span className="document-row__title">
              <strong>{doc.title}</strong>
              <span>{boardFor(doc.boardId)?.name}</span>
            </span>
            <span className="document-row__date">{doc.updated}</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </Panel>
      <p className="session-note">
        Open a document to write. Changes last for this session and reset on refresh.
      </p>
    </>
  );
}
