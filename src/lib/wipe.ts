/**
 * "Delete all data": everything the app keeps on this phone. The database
 * (customers, payments, staff, PINs, settings), exported files waiting in the
 * cache, shown and scheduled alerts, and the cloud sign-in. Cloud data itself
 * stays until the owner removes the business from the cloud or deletes the
 * cloud account (Settings, Cloud sync), which needs this sign-in, so the
 * confirmation text tells owners to do that first.
 */
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { cloudConfigured } from '../config';
import { deleteAllData } from '../db/repo';
import { signOut } from '../sync/cloud';
import { clearExportFiles } from './exportFiles';

export async function eraseEverything(db: SQLiteDatabase): Promise<void> {
  await deleteAllData(db);
  clearExportFiles();
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Notifications unavailable: nothing scheduled.
  }
  if (cloudConfigured) {
    try {
      await signOut();
    } catch {
      // Offline: the sign-in on this phone is still removed (see signOut).
    }
  }
}
