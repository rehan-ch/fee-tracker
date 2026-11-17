/**
 * Runs cloud sync in the background: when the app comes to the foreground,
 * a few seconds after local changes, every few minutes while open, and on
 * "Sync now". Screens read the status with useSyncStatus().
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { cloudConfigured } from '../config';
import { getMeta } from '../db/repo';
import { getSession, META_CLOUD_STAFF, supabaseRemote } from './cloud';
import { linkedBusinesses, syncBusiness } from './engine';

export interface SyncStatus {
  running: boolean;
  lastSyncAt: string | null;
  error: string | null;
}

let status: SyncStatus = { running: false, lastSyncAt: null, error: null };
const listeners = new Set<() => void>();
function set(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

let inFlight: Promise<void> | null = null;

/**
 * Sync every linked business this phone may sync: all of them with premium,
 * otherwise only businesses it joined as staff (the owner pays for those).
 */
export function runSync(db: SQLiteDatabase, premium: boolean): Promise<void> {
  if (!cloudConfigured) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const session = await getSession();
      if (!session) return;
      const linked = await linkedBusinesses(db);
      if (linked.length === 0) return;
      set({ running: true, error: null });
      for (const id of linked) {
        const joinedAsStaff = !!(await getMeta(db, META_CLOUD_STAFF(id)));
        if (premium || joinedAsStaff) await syncBusiness(db, supabaseRemote, id);
      }
      set({ running: false, lastSyncAt: new Date().toISOString() });
    } catch (e) {
      // Never log the error itself: server messages can quote row values.
      if (__DEV__) console.warn('Sync failed');
      set({ running: false, error: e instanceof Error ? e.name || 'Error' : 'Error' });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
