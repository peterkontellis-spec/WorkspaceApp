export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,.md,.csv';
export const ATTACHMENT_TYPES = Object.freeze({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv' });
export function attachmentName(value) {
  if (typeof value !== 'string' || !value || /\p{Cs}/u.test(value) || value !== value.trim() || value.length > 255 || new TextEncoder().encode(value).length > 255 || /[\u0000-\u001f\u007f-\u009f/\\:<>"|?*\u202a-\u202e\u2066-\u2069]/u.test(value) || value.startsWith('.') || value.endsWith('.') || value.includes('..')) return null;
  const extension = value.split('.').at(-1)?.toLowerCase();
  return Object.hasOwn(ATTACHMENT_TYPES, extension) ? { name: value, extension, mediaType: ATTACHMENT_TYPES[extension] } : null;
}
