'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { members } from '@/lib/demo';
import { AvatarStack } from './ui';

/** A native light-dismiss popover keeps multiple selection out of row layout. */
export function AssigneePicker({
  value,
  onChange,
  taskTitle,
  people,
  disabled = false,
}: {
  value: readonly string[];
  onChange: (ids: string[]) => void;
  taskTitle: string;
  people?: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const available = people ?? members;
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const names =
    available
      .filter((member) => value.includes(member.id))
      .map((member) => member.name)
      .join(', ') || 'Unassigned';

  function positionMenu() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, document.documentElement.clientWidth - 24);
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const upward = below < 280 && above > below;
    setPosition({
      width,
      left: Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12)),
      top: upward ? 'auto' : rect.bottom + 6,
      bottom: upward ? window.innerHeight - rect.top + 6 : 'auto',
      maxHeight: Math.max(48, (upward ? above : below) - 6),
    });
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = () => menu.current?.hidePopover();
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) dismiss();
    };
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <div className="assignee-picker">
      <button
        ref={trigger}
        type="button"
        className="assignee-trigger"
        disabled={disabled}
        popoverTarget={id}
        aria-label={`Assign people to ${taskTitle}. ${names}`}
        onClick={positionMenu}
      >
        {people ? <span>{names}</span> : value.length ? <AvatarStack ids={value} /> : <span>Unassigned</span>}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className="assignee-menu"
        style={position}
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        <fieldset>
          <legend>Assignees</legend>
          {available.map((member) => (
            <label key={member.id}>
              <input
                type="checkbox"
                disabled={disabled}
                name="assignees"
                value={member.id}
                checked={value.includes(member.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...value, member.id] : value.filter((id) => id !== member.id),
                  )
                }
              />
              <span>{member.name}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="button button--ghost assignee-done"
          popoverTarget={id}
          popoverTargetAction="hide"
        >
          Done
        </button>
      </div>
    </div>
  );
}
