'use client';

import { useId, useLayoutEffect, useRef, useState, type Ref, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DEMO_DATE } from '@/lib/demo';
import { calendarCells, calendarDate, moveCalendarDate, moveCalendarMonth } from '@/lib/calendar';
import './date-picker.css';

const fullDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// An in-page calendar avoids native date-popup crashes in the embedded browser.
export function DatePicker({ label, value, onChange, triggerRef }: { label: string; value: string; onChange: (value: string) => void; triggerRef?: Ref<HTMLButtonElement> }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(value || DEMO_DATE);
  const [focusDay, setFocusDay] = useState(false);
  const selected = calendarDate(value);
  const cells = calendarCells(cursor);
  useLayoutEffect(() => {
    if (!open || !focusDay) return;
    root.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)?.focus({ preventScroll: true });
    setFocusDay(false);
  }, [open, focusDay, cursor]);
  function close() {
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>('.date-picker-trigger')?.focus({ preventScroll: true });
  }
  function choose(date: string) { onChange(date); close(); }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const day = calendarDate(date)!;
    const weekday = (day.getUTCDay() + 6) % 7;
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    const next = event.key in offsets ? moveCalendarDate(date, offsets[event.key]) : event.key === 'PageUp' ? moveCalendarMonth(date, -1) : event.key === 'PageDown' ? moveCalendarMonth(date, 1) : null;
    if (next) { event.preventDefault(); setCursor(next); setFocusDay(true); }
  }
  return <div ref={root} className="date-picker" onKeyDown={(event) => {
    if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <span id={`${id}-label`} className="date-picker-label">{label}</span>
    <button ref={triggerRef} type="button" className="date-picker-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => {
      if (open) close(); else { setCursor(value || DEMO_DATE); setOpen(true); setFocusDay(true); }
    }}><span id={`${id}-value`}>{selected ? fullDate.format(selected) : 'No date'}</span><CalendarDays size={18} aria-hidden="true" /></button>
    {open && <section id={`${id}-calendar`} className="date-calendar" aria-label={`Choose ${label.toLowerCase()}`}>
      <div className="date-calendar-heading">
        <button type="button" aria-label="Previous month" onClick={() => setCursor(moveCalendarMonth(cursor, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
        <span aria-live="polite">{monthLabel.format(calendarDate(cursor)!)}</span>
        <button type="button" aria-label="Next month" onClick={() => setCursor(moveCalendarMonth(cursor, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <p className="sr-only">Use arrow keys for days, Page Up or Page Down for months, Enter to choose, and Escape to close.</p>
      <table aria-label={monthLabel.format(calendarDate(cursor)!)}><thead><tr>{weekDays.map((day) => <th scope="col" key={day} abbr={day}>{day.slice(0, 2)}</th>)}</tr></thead>
        <tbody>{Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>{cells.slice(week * 7, week * 7 + 7).map((date, index) => <td key={date ?? `empty-${index}`}>{date && <button type="button" data-date={date} tabIndex={date === cursor ? 0 : -1} aria-label={fullDate.format(calendarDate(date)!)} aria-pressed={date === value} onKeyDown={(event) => keyboard(event, date)} onClick={() => choose(date)}>{Number(date.slice(-2))}</button>}</td>)}</tr>)}</tbody>
      </table>
      <div className="date-calendar-actions"><button type="button" onClick={() => choose('')}>Clear date</button><button type="button" onClick={close}>Close calendar</button></div>
    </section>}
  </div>;
}
