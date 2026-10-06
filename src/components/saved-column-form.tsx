'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { WorkColumn } from '@/lib/work';
import { useWork } from './work-provider';
import { Button } from './ui';

export type ColumnEdit = { kind: 'column'; boardId: string; column?: WorkColumn; creationId?: string };
export function columnFormKey(edit: ColumnEdit) {
  return `form:column:${edit.column?.id ?? edit.boardId}`;
}
type Values = {
  name: string;
  kind: WorkColumn['kind'];
  options: string;
  format: 'number' | 'cost';
  currency: string;
  position: string;
};

export function SavedColumnForm({
  edit,
  pending,
  error,
  conflict,
  close,
  saved,
  dirty,
}: {
  edit: ColumnEdit;
  pending: boolean;
  error: string;
  conflict: boolean;
  close: () => void;
  saved: () => void;
  dirty: () => void;
}) {
  const work = useWork();
  const key = columnFormKey(edit);
  const [values, setValues] = useState<Values>(() => {
    const cached = work.drafts[key] as { values: Values } | undefined;
    return (
      cached?.values ?? {
        name: edit.column?.name ?? '',
        kind: edit.column?.kind ?? 'text',
        options: edit.column?.configuration.options?.join('\n') ?? 'To do\nIn progress\nDone',
        format: edit.column?.configuration.format ?? 'number',
        currency: edit.column?.configuration.currency ?? 'EUR',
        position: String(
          edit.column?.position ??
            Math.max(
              -1,
              ...(work.data?.columns.filter((c) => c.boardId === edit.boardId).map((c) => c.position) ?? []),
            ) + 1,
        ),
      }
    );
  });
  const used = Boolean(
    edit.column && work.data?.tasks.some((t) => t.fields.some((f) => f.columnId === edit.column!.id)),
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function patch(change: Partial<Values>) {
    const next = { ...values, ...change };
    setValues(next);
    work.setDraft(key, { edit, values: next });
    dirty();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const configuration: WorkColumn['configuration'] =
      values.kind === 'status'
        ? {
            options: values.options
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean),
          }
        : values.kind === 'number'
          ? { format: values.format, ...(values.format === 'cost' ? { currency: values.currency } : {}) }
          : {};
    const payload = {
      action: edit.column ? 'updateColumn' : 'createColumn',
      ...(edit.column
        ? { id: edit.column.id, revision: edit.column.revision }
        : { boardId: edit.boardId, creationId: edit.creationId }),
      name: values.name.trim(),
      kind: values.kind,
      configuration,
      position: Number(values.position),
    };
    if (await work.save(payload)) saved();
  }
  return (
    <form className="saved-form" onSubmit={submit} aria-busy={pending}>
      <p className="saved-task-hint">
        Columns belong to this board. Fill in their values when editing a task.
      </p>
      <label className="auth-field">
        Name
        <input
          name="column-name"
          autoComplete="off"
          required
          maxLength={120}
          value={values.name}
          readOnly={pending}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>
      <label className="auth-field">
        Type
        <select
          name="column-kind"
          value={values.kind}
          disabled={pending || used}
          onChange={(e) => patch({ kind: e.target.value as WorkColumn['kind'] })}
        >
          <option value="text">Text</option>
          <option value="status">Status</option>
          <option value="number">Number / cost</option>
          <option value="date">Date</option>
          <option value="link">Link</option>
        </select>
      </label>
      {used ? (
        <p className="auth-hint">
          This column contains saved values. Its type and number format are locked to protect them. You can
          rename or reorder it.
        </p>
      ) : null}
      {values.kind === 'status' ? (
        <label className="auth-field">
          Status options
          <textarea
            name="column-options"
            rows={4}
            maxLength={1620}
            required
            value={values.options}
            readOnly={pending}
            onChange={(e) => patch({ options: e.target.value })}
          />
          <span className="auth-hint">
            One option per line, up to 20. Options already used by tasks cannot be removed or renamed.
          </span>
        </label>
      ) : null}
      {values.kind === 'number' ? (
        <>
          <label className="auth-field">
            Number format
            <select
              name="column-format"
              value={values.format}
              disabled={pending || used}
              onChange={(e) => patch({ format: e.target.value as Values['format'] })}
            >
              <option value="number">Number</option>
              <option value="cost">Cost</option>
            </select>
          </label>
          {values.format === 'cost' ? (
            <label className="auth-field">
              Currency
              <select
                name="column-currency"
                value={values.currency}
                disabled={pending || used}
                onChange={(e) => patch({ currency: e.target.value })}
              >
                <option value="EUR">EUR — Euro</option>
                <option value="USD">USD — US dollar</option>
                <option value="GBP">GBP — British pound</option>
              </select>
              <span className="auth-hint">Up to two decimal places. No exchange-rate conversion.</span>
            </label>
          ) : null}
        </>
      ) : null}
      <label className="auth-field">
        Order
        <input
          name="column-position"
          type="number"
          autoComplete="off"
          inputMode="numeric"
          min={0}
          max={2147483646}
          step={1}
          required
          value={values.position}
          readOnly={pending}
          onChange={(e) => patch({ position: e.target.value })}
        />
        <span className="auth-hint">Lower numbers appear first.</span>
      </label>
      {error ? (
        <p ref={errorRef} tabIndex={-1} className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {conflict ? (
        <p className="auth-hint">
          Your input is retained. Copy anything needed, cancel, refresh the board and reopen this column to
          edit its latest version.
        </p>
      ) : null}
      <div className="saved-actions">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save column'}
        </Button>
        <Button onClick={close} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
