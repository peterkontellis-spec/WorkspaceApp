export const ATTACHMENT_MAX_BYTES: number;
export const ATTACHMENT_ACCEPT: string;
export const ATTACHMENT_TYPES: Readonly<Record<string, string>>;
export function attachmentName(value: unknown): { name: string; extension: string; mediaType: string } | null;
