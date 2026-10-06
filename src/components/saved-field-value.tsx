import type { WorkColumn } from '@/lib/work';
import { workDate } from '@/lib/work';
export function SavedFieldValue({ column, value }: { column: WorkColumn; value?: string | number }) {
  if (value === undefined) return <span className="saved-empty-value">Not set</span>;
  if (column.kind === 'date') return <>{workDate(String(value))}</>;
  if (column.kind === 'number' && typeof value === 'number') return <>{new Intl.NumberFormat(undefined, column.configuration.format === 'cost' ? {style:'currency',currency:column.configuration.currency??'EUR'} : {maximumSignificantDigits:21}).format(value)}</>;
  if (column.kind === 'link') {
    try { const url = new URL(String(value)); if (['https:','http:'].includes(url.protocol) && !url.username && !url.password) return <a className="text-link" href={url.href} target="_blank" rel="noopener noreferrer">{String(value)}</a>; } catch { /* Invalid historical values stay plain text. */ }
  }
  return <>{String(value)}</>;
}
