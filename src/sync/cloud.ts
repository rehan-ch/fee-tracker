/**
 * Supabase connection for cloud sync (premium). Only used when the Supabase
 * URL and key are configured (see config.ts and supabase/README.md).
 *
 * Accounts sign in with a 6-digit code sent by email, so there are no
 * passwords and no SMS costs. The owner links a business; staff join it on
 * their own phones with a one-time invite code.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { getRandomBytes } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';

import { CLOUD, cloudConfigured } from '../config';
import {
  cloudStaffKey,
  currentStaffKey,
  getBusinessById,
  ownerStaff,
  setStaffInvite,
  upsertMeta,
  writeTx,
} from '../db/repo';
import type { SyncTable } from '../db/schema';
import { isSafeId } from '../lib/rowSchema';
import { linkBusiness, unlinkBusiness, type Cursor, type PullPage, type RemoteStore, type Row } from './engine';
import { secureSessionStorage } from './sessionStorage';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client) {
    // The session (tokens) is kept in Android's encrypted SecureStore.
    client = createClient(CLOUD.url, CLOUD.key, {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // Refresh the session only while the app is in the foreground.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

function need(): SupabaseClient {
  const c = supabase();
  if (!c) throw new Error('Cloud sync is not configured');
  return c;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  const c = supabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

/** Email a 6-digit sign-in code (creates the account on first use). */
export async function sendCode(email: string): Promise<void> {
  const { error } = await need().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyCode(email: string, code: string): Promise<Session> {
  const { data, error } = await need().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error || !data.session) throw error ?? new Error('No session');
  return data.session;
}

/**
 * Password sign-in, for accounts created in the Supabase dashboard (for
 * example the demo account you give Google Play's reviewers).
 */
export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await need().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session) throw error ?? new Error('No session');
  return data.session;
}

/**
 * Sign out: ends the session on the server too when online; the sign-in
 * saved on this phone is removed either way.
 */
export async function signOut(): Promise<void> {
  const c = need();
  const { error } = await c.auth.signOut();
  if (error) await c.auth.signOut({ scope: 'local' });
}

// ---------------------------------------------------------------------------
// Sync transport
// ---------------------------------------------------------------------------

export const supabaseRemote: RemoteStore = {
  async push(table: SyncTable, rows: Row[]) {
    const { error } = await need().rpc('push_rows', { p_table: table, p_rows: rows });
    if (error) throw error;
  },
  async pull(table: SyncTable, businessId: string, since: Cursor | null, limit: number, overlap: boolean) {
    const { data, error } = await need().rpc('pull_rows', {
      p_table: table,
      p_business: businessId,
      p_since_ts: since?.ts ?? null,
      p_since_id: since?.id ?? null,
      p_limit: limit,
      p_overlap: overlap,
    });
    if (error) throw error;
    const list = (data ?? []) as { data: Row; ts: string; row_id: string }[];
    const last = list[list.length - 1];
    const page: PullPage = {
      rows: list.map((r) => r.data),
      next: last ? { ts: last.ts, id: last.row_id } : null,
    };
    return page;
  },
};

// ---------------------------------------------------------------------------
// Businesses in the cloud
// ---------------------------------------------------------------------------

/** Owner: put this business in the cloud and queue all its data for upload. */
export async function enableCloud(db: SQLiteDatabase, businessId: string): Promise<void> {
  const business = await getBusinessById(db, businessId);
  const owner = await ownerStaff(db, businessId);
  if (!business || !owner) throw new Error('Business not found');
  const { error } = await need().rpc('link_business', { p_business: business, p_owner: owner });
  if (error) throw error;
  await linkBusiness(db, businessId, true);
}

/** Owner: delete the business from the cloud. This phone keeps its data. */
export async function removeFromCloud(db: SQLiteDatabase, businessId: string): Promise<void> {
  const { error } = await need().rpc('unlink_business', { p_business: businessId });
  if (error) throw error;
  await unlinkBusiness(db, businessId);
}

export interface CloudMembership {
  business_id: string;
  name: string;
  role: 'owner' | 'manager' | 'collector';
  staff_id: string;
}

const ROLES: readonly string[] = ['owner', 'manager', 'collector'];

/** A membership row from the server, or null if it isn't one (ids end up in screen routes and settings). */
export function asMembership(v: unknown): CloudMembership | null {
  if (typeof v !== 'object' || v === null) return null;
  const m = v as Record<string, unknown>;
  if (!isSafeId(m.business_id) || !isSafeId(m.staff_id) || typeof m.role !== 'string' || !ROLES.includes(m.role)) {
    return null;
  }
  return {
    business_id: m.business_id,
    staff_id: m.staff_id,
    role: m.role as CloudMembership['role'],
    name: typeof m.name === 'string' ? m.name.slice(0, 200) : '',
  };
}

export async function myBusinesses(): Promise<CloudMembership[]> {
  const { data, error } = await need().rpc('my_businesses');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(asMembership).filter((m): m is CloudMembership => m !== null);
}

export const META_CLOUD_STAFF = cloudStaffKey;

/**
 * Start syncing a cloud business on this phone (staff who joined, or the
 * owner on a new phone). The data downloads on the next sync. Non-owners
 * use the app as their own staff member.
 */
export async function addCloudBusiness(db: SQLiteDatabase, m: CloudMembership): Promise<void> {
  await linkBusiness(db, m.business_id, false);
  await writeTx(db, async () => {
    // Staff phones are locked to their own staff member; the owner can switch.
    if (m.role !== 'owner') await upsertMeta(db, META_CLOUD_STAFF(m.business_id), m.staff_id);
    await upsertMeta(db, currentStaffKey(m.business_id), m.staff_id);
    await upsertMeta(db, 'active_business', m.business_id);
  });
}

export class JoinError extends Error {
  constructor(public kind: 'invalid' | 'tooMany' | 'other') {
    super(kind);
  }
}

/** Invite codes as the owner's phone makes them (see createInvite); anything else can't be one. */
export const normalizeInviteCode = (code: string) => code.trim().toUpperCase();
export const isInviteCodeShape = (code: string) => /^[A-Z0-9]{8,32}$/.test(code);

/**
 * Staff: join a business with the code the owner shared. The server answers
 * a wrong or used code with no row (and counts the attempt).
 */
export async function joinWithCode(db: SQLiteDatabase, code: string): Promise<CloudMembership> {
  const { data, error } = await need().rpc('join_business', { p_code: normalizeInviteCode(code) });
  if (error) {
    // P0002: servers without the 2026-11-14 security migration.
    if (error.code === 'P0002') throw new JoinError('invalid');
    if (error.code === '54000') throw new JoinError('tooMany');
    throw new JoinError('other');
  }
  const m = asMembership(Array.isArray(data) ? data[0] : null);
  if (!m) throw new JoinError('invalid');
  await addCloudBusiness(db, m);
  return m;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Owner: create a one-time code for a staff member (uploaded with the next sync). */
export async function createInvite(db: SQLiteDatabase, staffId: string): Promise<string> {
  const bytes = getRandomBytes(8);
  const code = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  await setStaffInvite(db, staffId, code);
  return code;
}

/** Delete the cloud account (and businesses it owns in the cloud). Local data stays. */
export async function deleteCloudAccount(db: SQLiteDatabase, linked: string[]): Promise<void> {
  const { error } = await need().rpc('delete_my_account');
  if (error) throw error;
  for (const id of linked) await unlinkBusiness(db, id);
  await need().auth.signOut();
}
