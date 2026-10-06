'use client';

import { useState, type FormEvent } from 'react';
import type { WorkMember } from '@/lib/work';
import { hasWorkFilters, type WorkFilters } from '@/lib/work-filters.mjs';
import { Button } from './ui';

export function SavedWorkFilters({
  filters,
  members,
  count,
  total,
  apply,
}: {
  filters: WorkFilters;
  members: WorkMember[];
  count: number;
  total: number;
  apply: (filters: WorkFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const advanced = [filters.status, filters.assignee, filters.priority, filters.due].filter(Boolean).length;
  const active = hasWorkFilters(filters);
  const dueLabels: Record<string, string> = {
    overdue: 'Before today',
    today: 'Today',
    upcoming: 'After today',
    none: 'No date',
  };
  const assignee =
    filters.assignee === 'unassigned'
      ? 'Unassigned'
      : (members.find((member) => member.id === filters.assignee)?.name ?? 'Unavailable person');
  const summary = [
    filters.q.trim() ? `“${filters.q.trim()}”` : '',
    filters.status,
    filters.assignee ? assignee : '',
    filters.priority ? `${filters.priority} priority` : '',
    dueLabels[filters.due],
  ]
    .filter(Boolean)
    .join(' · ');
  function submit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }
  return (
    <div className="saved-filters">
      <form onSubmit={submit} role="search" aria-label="Find saved tasks">
        <div className="saved-search-line">
          <label className="auth-field">
            <span>Search tasks</span>
            <input
              type="search"
              name="q"
              maxLength={200}
              autoComplete="off"
              placeholder="Search titles and notes…"
              value={draft.q}
              onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            />
          </label>
          <Button type="submit">Search</Button>
        </div>
        <details className="saved-filter-options">
          <summary>Filters{advanced ? ` (${advanced})` : ''}</summary>
          <div className="saved-filter-grid">
            <label className="auth-field">
              Status
              <select
                name="status"
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              >
                <option value="">Any status</option>
                {['To do', 'In progress', 'Done'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              Assignee
              <select
                name="assignee"
                value={draft.assignee}
                onChange={(event) => setDraft({ ...draft, assignee: event.target.value })}
              >
                <option value="">Anyone</option>
                <option value="unassigned">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
                {draft.assignee &&
                draft.assignee !== 'unassigned' &&
                !members.some((member) => member.id === draft.assignee) ? (
                  <option value={draft.assignee}>Unavailable person</option>
                ) : null}
              </select>
            </label>
            <label className="auth-field">
              Priority
              <select
                name="priority"
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
              >
                <option value="">Any priority</option>
                {['Low', 'Medium', 'High'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              Due date
              <select
                name="due"
                value={draft.due}
                onChange={(event) => setDraft({ ...draft, due: event.target.value })}
              >
                <option value="">Any date</option>
                {Object.entries(dueLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="auth-hint">
            Dates use your local day. Combine with Status to include or exclude completed tasks.
          </p>
          <Button type="submit">Apply filters</Button>
        </details>
      </form>
      <div className="saved-filter-result">
        <p id="saved-filter-result" tabIndex={-1} role="status">
          {count} of {total} tasks{summary ? <span> · {summary}</span> : null}
        </p>
        {active ? (
          <Button
            variant="ghost"
            onClick={() => apply({ q: '', status: '', assignee: '', priority: '', due: '' })}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
