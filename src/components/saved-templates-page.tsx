'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Dialog } from './ui';
import { useWork } from './work-provider';
import { useTemplates } from './use-templates';
import type { WorkSnapshot } from '@/lib/work';
import type { TemplateLibrary, WorkTemplate } from '@/lib/templates';
import './saved-work.css';
import './saved-templates.css';

type Draft = {
  mode: 'save' | 'use';
  kind: 'task' | 'board';
  name: string;
  sourceId: string;
  revision: number;
  boardId: string;
  groupId: string;
  creationId: string;
  template?: WorkTemplate;
};
const draftKey = 'templates:form';
function CopyRules() {
  return (
    <details className="template-rules">
      <summary>What is included in a template?</summary>
      <p>
        Copies keep titles, instructions, priorities, subtasks and checklist labels. Board templates also keep
        groups and column settings. Text and number fields keep their values.
      </p>
      <p>
        Every copy starts at To do, with unchecked lists and no dates or assignees. Custom status, date and
        link values are cleared. Attachments, time entries and previous activity are excluded.
      </p>
      <p>
        Notes are copied as plain text, including any links written inside them. Documents are not copied or
        connected. Dependencies copy only when both tasks are included; links to other tasks are excluded.
        Task templates reuse matching columns or add missing ones; a conflicting column definition must be
        resolved first.
      </p>
      <p>
        Templates support up to 200 tasks, 100 groups and 20 custom columns. Templates capture the latest
        saved work when submitted. Later changes to the source, template copies or new projects do not change
        one another.
      </p>
    </details>
  );
}
export function SavedTemplatesPage() {
  const work = useWork();
  if (!work.data)
    return (
      <section>
        <h1>Templates</h1>
        <p role={work.error ? 'alert' : 'status'}>{work.error || 'Loading saved work…'}</p>
        {work.error && <Button onClick={() => void work.refresh()}>Retry</Button>}
      </section>
    );
  return <TemplateContent key={work.data.actor.id} data={work.data} />;
}
function TemplateContent({ data }: { data: WorkSnapshot }) {
  const work = useWork();
  const library = useTemplates(data.actor.id);
  const params = useSearchParams();
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(() => {
    const saved = work.drafts[draftKey] as Draft | undefined;
    if (saved) return saved;
    const kind = params.get('kind') === 'task' ? 'task' : 'board';
    const source =
      kind === 'board'
        ? data.boards.find((b) => b.id === params.get('source'))
        : data.tasks.find((t) => t.id === params.get('source'));
    return source && data.actor.role !== 'viewer'
      ? {
          mode: 'save',
          kind,
          name: 'name' in source ? source.name : source.title,
          sourceId: source.id,
          revision: source.revision,
          boardId: '',
          groupId: '',
          creationId: crypto.randomUUID(),
        }
      : null;
  });
  const [discard, setDiscard] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<WorkTemplate | null>(null);
  const [result, setResult] = useState<{ href: string; label: string } | null>(null);
  const [localError, setLocalError] = useState('');
  const [reloading, setReloading] = useState(false);
  const finishFocus = useRef(false);
  const resultLink = useRef<HTMLAnchorElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const libraryTitle = useRef<HTMLHeadingElement>(null);
  const finishArchive = useRef(false);
  useEffect(() => {
    if (!archiveTarget && finishArchive.current) {
      libraryTitle.current?.focus();
      finishArchive.current = false;
    }
  }, [archiveTarget]);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (draft) formTitle.current?.focus();
  }, [draft?.creationId]);
  useEffect(() => {
    if (!draft && finishFocus.current) {
      (resultLink.current ?? saveButton.current)?.focus();
      finishFocus.current = false;
    }
  }, [draft, result]);
  const canEdit = data.actor.role !== 'viewer' && library.state !== 'expired';
  const { setDraft: cacheDraft } = work;
  useEffect(() => {
    cacheDraft(draftKey, draft);
  }, [draft, cacheDraft]);
  useEffect(() => {
    if (library.error || localError) errorRef.current?.focus();
  }, [library.error, localError]);
  const close = () => {
    if (!library.pending && !reloading) {
      finishFocus.current = true;
      setDraft(null);
      setDiscard(false);
      setLocalError('');
    }
  };
  const beginSave = () => {
    library.clearFeedback();
    setResult(null);
    setLocalError('');
    setDraft({
      mode: 'save',
      kind: 'board',
      name: '',
      sourceId: '',
      revision: 0,
      boardId: '',
      groupId: '',
      creationId: crypto.randomUUID(),
    });
  };
  const beginUse = (template: WorkTemplate) => {
    library.clearFeedback();
    setResult(null);
    setLocalError('');
    setDraft({
      mode: 'use',
      kind: template.kind,
      name: template.name,
      sourceId: '',
      revision: template.revision,
      boardId: '',
      groupId: '',
      creationId: crypto.randomUUID(),
      template,
    });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !canEdit || reloading) return;
    setLocalError('');
    if (draft.mode === 'save' && !draft.sourceId) {
      setLocalError('Choose saved work to capture.');
      return;
    }
    const payload =
      draft.mode === 'save'
        ? {
            action: 'save',
            creationId: draft.creationId,
            kind: draft.kind,
            sourceId: draft.sourceId,
            revision: draft.revision,
            name: draft.name,
          }
        : {
            action: 'use',
            creationId: draft.creationId,
            templateId: draft.template!.id,
            revision: draft.revision,
            ...(draft.kind === 'board'
              ? { name: draft.name }
              : { boardId: draft.boardId, groupId: draft.groupId }),
          };
    const response = await library.mutate(payload);
    if (!response) return;
    if (response.boardId)
      setResult({
        href: `/boards/${response.boardId}${response.taskId ? `?task=${response.taskId}` : ''}`,
        label: draft.kind === 'board' ? 'Open new board' : 'Open new task',
      });
    finishFocus.current = true;
    setDraft(null);
    setDiscard(false);
  };
  const reloadVersion = async () => {
    if (!draft || reloading || library.pending) return;
    setReloading(true);
    const current = draft;
    try {
      const response = await fetch(current.mode === 'save' ? '/api/work' : '/api/templates', {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const value = await response.json();
      if (!response.ok || value.actor?.id !== data.actor.id || value.actor?.role === 'viewer')
        throw new Error('Your access changed or saved work is unavailable. Refresh and try again.');
      const source =
        current.mode === 'save'
          ? (current.kind === 'board' ? (value as WorkSnapshot).boards : (value as WorkSnapshot).tasks).find(
              (item) => item.id === current.sourceId,
            )
          : (value as TemplateLibrary).templates.find((item) => item.id === current.template?.id);
      if (!source) throw new Error('This source is no longer active. Restore it or choose another template.');
      setDraft((previous) =>
        previous?.creationId === current.creationId
          ? {
              ...previous,
              revision: source.revision,
              ...(current.mode === 'use' ? { template: source as WorkTemplate } : {}),
            }
          : previous,
      );
      setLocalError('');
      library.clearFeedback();
      formTitle.current?.focus();
    } catch (failure) {
      setLocalError(failure instanceof Error ? failure.message : 'Could not reload this version. Try again.');
    } finally {
      setReloading(false);
    }
  };
  const items = (archived ? library.report?.archivedTemplates : library.report?.templates) ?? [];
  const filtered = items.filter((t) => t.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  const formError = localError || library.error;
  return (
    <section className="templates-page">
      <div className="page-heading">
        <div>
          <h1 ref={libraryTitle} tabIndex={-1}>
            Templates
          </h1>
          <p className="page-description">Start from work you have already planned.</p>
        </div>
        <div className="saved-actions">
          <Button onClick={() => void library.refresh()} disabled={library.pending}>
            Refresh templates
          </Button>
          {canEdit && (
            <button
              ref={saveButton}
              type="button"
              className="button button--primary"
              onClick={beginSave}
              disabled={Boolean(draft) || library.pending}
            >
              Save a template
            </button>
          )}
        </div>
      </div>
      <p className="template-hint">
        Reusable boards and tasks, shared with your team. Each copy is independent.
      </p>
      {!canEdit && <p className="saved-scope">Viewer access · templates are read-only.</p>}
      {library.state !== 'current' && (
        <p role="status" className="template-hint">
          {library.state === 'offline'
            ? 'Offline · showing the last saved list. Reconnect before making changes.'
            : library.state === 'expired'
              ? 'Your access changed. Sign in again.'
              : 'Checking template updates…'}
        </p>
      )}
      {!draft && formError && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">
          {formError}
        </p>
      )}
      <p role="status" className="saved-notice">
        {library.notice}{' '}
        {result && (
          <Link ref={resultLink} className="text-link" href={result.href}>
            {result.label}
          </Link>
        )}
      </p>
      <CopyRules />
      <div className="template-toolbar">
        <label>
          Find a template
          <input
            name="template-search"
            autoComplete="off"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search template names…"
          />
        </label>
        <Button aria-pressed={archived} onClick={() => setArchived(!archived)}>
          {archived ? 'Show active templates' : 'Show archived templates'}
        </Button>
      </div>
      {!library.report ? (
        <p role="status">Loading templates…</p>
      ) : !filtered.length ? (
        <p className="template-empty">
          {query
            ? 'No templates match this search.'
            : archived
              ? 'No archived templates.'
              : 'No templates yet. Save a board or task to reuse its structure.'}
        </p>
      ) : (
        <ul className="template-list">
          {filtered.map((template) => (
            <li key={template.id} data-template-id={template.id}>
              <div>
                <h2>{template.name}</h2>
                <p>
                  {template.kind === 'board' ? 'Board' : 'Task'} template · {template.taskCount} task
                  {template.taskCount === 1 ? '' : 's'} · {template.columnCount} custom column
                  {template.columnCount === 1 ? '' : 's'}
                  {template.kind === 'board'
                    ? ` · ${template.groupCount} group${template.groupCount === 1 ? '' : 's'}`
                    : ''}
                </p>
              </div>
              <div className="saved-actions">
                {canEdit && !archived && (
                  <Button onClick={() => beginUse(template)} disabled={Boolean(draft) || library.pending}>
                    Use template
                  </Button>
                )}
                {canEdit && (template.kind === 'task' || data.actor.role === 'owner') && (
                  <Button disabled={library.pending} onClick={() => setArchiveTarget(template)}>
                    {archived ? 'Restore template' : 'Archive template'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {draft && (
        <section className="template-form-section" aria-labelledby="template-form-title">
          <h2 id="template-form-title" ref={formTitle} tabIndex={-1}>
            {draft.mode === 'save' ? 'Save reusable work' : `Use “${draft.template?.name}”`}
          </h2>
          <p className="template-hint">
            {draft.mode === 'save'
              ? 'Save task edits first. This captures the latest saved version, including its active subtasks.'
              : 'The original stays unchanged. Dates and assignments will be empty in the new copy.'}
          </p>
          <form onSubmit={submit} className="template-form">
            <fieldset disabled={library.pending || reloading || !canEdit}>
              {draft.mode === 'save' && (
                <>
                  <label>
                    Template type
                    <select
                      name="template-kind"
                      value={draft.kind}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          kind: e.target.value as 'board' | 'task',
                          sourceId: '',
                          revision: 0,
                        })
                      }
                    >
                      <option value="board">Board</option>
                      <option value="task">Task and checklist</option>
                    </select>
                  </label>
                  <label>
                    Saved {draft.kind}
                    <select
                      name="template-source"
                      required
                      value={draft.sourceId}
                      onChange={(e) => {
                        const item = (draft.kind === 'board' ? data.boards : data.tasks).find(
                          (s) => s.id === e.target.value,
                        );
                        setDraft({ ...draft, sourceId: e.target.value, revision: item?.revision ?? 0 });
                      }}
                    >
                      <option value="">Choose {draft.kind}…</option>
                      {draft.kind === 'board'
                        ? data.boards.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))
                        : data.tasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {data.boards.find((b) => b.id === t.boardId)?.name} · {t.title}
                            </option>
                          ))}
                    </select>
                  </label>
                </>
              )}
              {(draft.mode === 'save' || draft.kind === 'board') && (
                <label>
                  {draft.mode === 'save' ? 'Template name' : 'New board name'}
                  <input
                    name="template-name"
                    autoComplete="off"
                    required
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
              )}
              {draft.mode === 'use' && draft.kind === 'task' && (
                <>
                  <label>
                    Destination board
                    <select
                      name="destination-board"
                      required
                      value={draft.boardId}
                      onChange={(e) => setDraft({ ...draft, boardId: e.target.value, groupId: '' })}
                    >
                      <option value="">Choose board…</option>
                      {data.boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Destination group
                    <select
                      name="destination-group"
                      required
                      value={draft.groupId}
                      onChange={(e) => setDraft({ ...draft, groupId: e.target.value })}
                    >
                      <option value="">Choose group…</option>
                      {data.groups
                        .filter((g) => g.boardId === draft.boardId)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
            </fieldset>
            {formError && (
              <p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">
                {formError}
              </p>
            )}
            {library.error === 'This item changed. Reload it before continuing.' && (
              <div className="template-hint">
                <p>
                  Review the latest saved version before submitting again. Your name and destination will be
                  kept.
                </p>
                <Button
                  disabled={library.pending || reloading || !canEdit}
                  onClick={() => void reloadVersion()}
                >
                  {reloading ? 'Reloading…' : 'Use latest saved version'}
                </Button>
              </div>
            )}
            {discard ? (
              <div className="template-discard">
                <p>
                  Your input is kept until you discard it. If a save was not confirmed, check the list before
                  creating another copy.
                </p>
                <Button onClick={() => setDiscard(false)}>Keep editing</Button>
                <Button onClick={close}>Discard input</Button>
              </div>
            ) : (
              <div className="saved-actions">
                <Button disabled={library.pending || reloading} onClick={() => setDiscard(true)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={library.pending || reloading || !canEdit}>
                  {library.pending
                    ? 'Saving…'
                    : draft.mode === 'save'
                      ? 'Save template'
                      : draft.kind === 'board'
                        ? 'Create board from template'
                        : 'Create task from template'}
                </Button>
              </div>
            )}
          </form>
        </section>
      )}
      <Dialog
        open={Boolean(archiveTarget)}
        title={archived ? 'Restore template' : 'Archive template'}
        onClose={() => {
          if (!library.pending) setArchiveTarget(null);
        }}
      >
        {archiveTarget && (
          <>
            <p>
              {archived
                ? 'Make this template available again?'
                : 'Hide this template from the active library? Existing copies stay unchanged, and the template can be restored.'}
            </p>
            <p>
              <strong>{archiveTarget.name}</strong>
            </p>
            {library.error && (
              <p role="alert" className="auth-error">
                {library.error}
              </p>
            )}
            <div className="saved-actions">
              <Button disabled={library.pending} onClick={() => setArchiveTarget(null)}>
                Cancel
              </Button>
              <Button
                disabled={library.pending}
                onClick={async () => {
                  const value = await library.mutate({
                    action: archived ? 'restore' : 'archive',
                    id: archiveTarget.id,
                    revision: archiveTarget.revision,
                  });
                  if (value) {
                    finishArchive.current = true;
                    setArchiveTarget(null);
                  }
                }}
              >
                {library.pending ? 'Saving…' : archived ? 'Confirm restore' : 'Confirm archive'}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
