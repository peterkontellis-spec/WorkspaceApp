'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { FILE_ACCEPT, MAX_FILE_BYTES, attachmentName, fileSize, type SavedFile } from '@/lib/files';
import { Button } from './ui';
import './auth.css';
import './saved-files.css';

function useFiles(taskId?: string) {
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const url = `/api/files${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''}`;
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.any([next.signal, AbortSignal.timeout(15_000)]),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Your session ended. Sign in again.'
            : 'Could not load files. Check your connection and refresh.',
        );
      const result = await response.json();
      if (generation.current !== request) return false;
      setFiles(result.files);
      return true;
    } catch (error) {
      if (generation.current === request && !next.signal.aborted)
        setError(
          error instanceof Error && !(error instanceof DOMException) && !(error instanceof TypeError)
            ? error.message
            : 'Could not load files. Check your connection and refresh.',
        );
      return false;
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [refresh]);
  return { files, setFiles, loading, error, refresh };
}

function FileList({ files, showTask = false }: { files: SavedFile[]; showTask?: boolean }) {
  return (
    <ul className="saved-file-list">
      {files.map((file) => (
        <li key={file.id}>
          <FileText size={21} aria-hidden="true" />
          <div className="saved-file-copy">
            <strong>{file.originalName}</strong>
            <p>
              {fileSize(file.byteSize)} ·{' '}
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(file.createdAt))}
            </p>
            {showTask ? (
              <Link
                className="text-link saved-file-task"
                href={`/boards/${file.boardId}?task=${file.taskId}`}
              >
                {file.taskTitle} · {file.boardName}
              </Link>
            ) : null}
          </div>
          <a
            className="button button--secondary saved-file-download"
            href={`/api/files/${file.id}`}
            download={file.originalName}
            aria-label={`Download ${file.originalName}`}
          >
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SavedTaskAttachments({
  taskId,
  canEdit,
  blocked = false,
}: {
  taskId: string;
  canEdit: boolean;
  blocked?: boolean;
}) {
  const { files, setFiles, loading, error: listError, refresh } = useFiles(taskId);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const upload = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(false);
  const validFile = Boolean(
    file && file.size > 0 && file.size <= MAX_FILE_BYTES && attachmentName(file.name),
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      upload.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  function choose(next: File | null) {
    setNotice('');
    setError('');
    setFile(next);
    if (next && (!next.size || next.size > MAX_FILE_BYTES))
      setError('Choose a non-empty file no larger than 25 MiB.');
    else if (next && !FILE_ACCEPT.split(',').some((extension) => next.name.toLowerCase().endsWith(extension)))
      setError('Choose a PDF, PNG, JPEG, TXT, Markdown or CSV file.');
    else if (next && !attachmentName(next.name))
      setError('Use a shorter filename without special characters, then choose it again.');
  }
  async function send() {
    if (!file || !validFile || blocked || loading || busy || upload.current || uncertain || error) return;
    const controller = new AbortController();
    upload.current = controller;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/files?taskId=${encodeURIComponent(taskId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Upload-Name': encodeURIComponent(file.name),
        },
        body: file,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]),
      });
      const result = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        setError(result.error || 'Upload failed. Refresh files before trying again.');
        if (response.status >= 500) setUncertain(true);
        return;
      }
      setFiles((current) => [result.file, ...current.filter((saved) => saved.id !== result.file.id)]);
      setNotice(`${result.file.originalName} uploaded.`);
      setFile(null);
      if (input.current) input.current.value = '';
    } catch {
      if (mounted.current) {
        setUncertain(true);
        setError(
          'Upload could not be confirmed. Refresh files to check whether it finished before trying again.',
        );
      }
    } finally {
      upload.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  async function reload() {
    if (await refresh()) {
      setUncertain(false);
      setError('');
    }
  }
  return (
    <section className="saved-task-attachments" aria-label="Task attachments">
      <div className="saved-files-heading">
        <h3>Attachments</h3>
        <Button variant="ghost" disabled={busy || loading} onClick={() => void reload()}>
          {loading ? 'Refreshing…' : 'Refresh files'}
        </Button>
      </div>
      {listError ? (
        <p role="alert" className="auth-error">
          {listError}
        </p>
      ) : loading ? (
        <p role="status" className="auth-hint">
          Loading files…
        </p>
      ) : files.length ? (
        <FileList files={files} />
      ) : (
        <p className="auth-hint">No attachments yet.</p>
      )}
      {canEdit ? (
        <div className="saved-file-upload">
          <label className="auth-field">
            Choose an attachment
            <input
              ref={input}
              type="file"
              name="attachment"
              accept={FILE_ACCEPT}
              disabled={busy || blocked}
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
              aria-describedby={`file-help-${taskId}`}
            />
          </label>
          <p id={`file-help-${taskId}`} className="auth-hint">
            PDF, PNG/JPEG or UTF-8 TXT, Markdown and CSV · Up to 25 MiB. Upload saves separately from task
            edits.
          </p>
          {blocked ? (
            <p className="auth-hint">Save or cancel your task edits before uploading a file.</p>
          ) : null}
          {file ? (
            <p className="saved-file-selection">
              Selected: {file.name} · {fileSize(file.size)}
            </p>
          ) : null}
          <div className="saved-file-actions">
            <Button
              disabled={!validFile || loading || busy || blocked || uncertain || Boolean(error)}
              onClick={() => void send()}
            >
              {busy ? 'Uploading…' : 'Upload file'}
            </Button>
            {busy ? <Button onClick={() => upload.current?.abort()}>Cancel upload</Button> : null}
          </div>
          {busy ? (
            <p role="status" className="auth-hint">
              Keep this task open until the upload finishes. Leaving cancels an unfinished transfer.
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="saved-file-notice">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

export function SavedFilesPage() {
  const { files, loading, error, refresh } = useFiles();
  return (
    <section className="saved-files-page">
      <div className="page-heading">
        <div>
          <h1>Files</h1>
          <p className="page-description">Attachments saved with your team’s tasks.</p>
        </div>
        <Button disabled={loading} onClick={() => void refresh()}>
          {loading ? 'Refreshing…' : 'Refresh files'}
        </Button>
      </div>
      <p className="saved-files-intro">
        Owners and editors upload from a task’s Attachments section. Files download to your device.
      </p>
      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : loading ? (
        <p role="status">Loading files…</p>
      ) : files.length ? (
        <>
          <p role="status" className="auth-hint">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </p>
          <FileList files={files} showTask />
        </>
      ) : (
        <div className="saved-files-empty">
          <h2>No files yet</h2>
          <p>An owner or editor can open a task to add its first attachment.</p>
          <Link className="auth-link" href="/boards">
            Browse boards
          </Link>
        </div>
      )}
    </section>
  );
}
