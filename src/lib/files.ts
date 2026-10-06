export type SavedFile = { id: string; taskId: string; taskTitle: string; boardId: string; boardName: string; originalName: string; mediaType: string; byteSize: number; createdAt: string };
export { ATTACHMENT_MAX_BYTES as MAX_FILE_BYTES, ATTACHMENT_ACCEPT as FILE_ACCEPT, attachmentName } from './attachment-policy.mjs';
export function fileSize(bytes: number) {
  const unit = bytes >= 1024 * 1024 ? 'MiB' : bytes >= 1024 ? 'KiB' : 'bytes';
  const size = unit === 'MiB' ? bytes / (1024 * 1024) : unit === 'KiB' ? bytes / 1024 : bytes;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(size)} ${unit}`;
}
