import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDatabase } from './db';
import { createAuthentication, verifiedActor } from './auth-core.mjs';
export type SignedInAccount = { id: string; name: string; email: string; role: string; workspaceId: string };
export function prototypeMode() { return process.env.WORKSPACE_MODE === 'prototype'; }
let instance: ReturnType<typeof createAuthentication> | undefined;
export function getAuth() {
  instance ??= createAuthentication(getDatabase(), { secret: process.env.AUTH_SECRET, baseURL: process.env.AUTH_BASE_URL });
  return instance;
}
export const currentAccount = cache(async (): Promise<SignedInAccount | null> => verifiedActor(getAuth(), getDatabase(), await headers()));
export const activeAccount = cache(async (): Promise<SignedInAccount | null> => verifiedActor(getAuth(), getDatabase(), await headers(), { touch: true }));
export async function requireAccount() {
  if (prototypeMode()) return null;
  let account;
  try { account = await activeAccount(); }
  catch { redirect('/sign-in?unavailable=1'); }
  if (!account) redirect('/sign-in');
  return account;
}
