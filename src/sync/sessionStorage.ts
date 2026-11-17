/**
 * Where the cloud sign-in session (access and refresh tokens) is kept:
 * Android's encrypted SecureStore (Keystore-backed), not a plain database
 * file. SecureStore data is left out of Android device backups and can't be
 * read on another phone, so a copied backup never carries a working login.
 *
 * Sessions saved by earlier versions in plain storage are moved here the
 * first time they are read.
 */
import * as SecureStore from 'expo-secure-store';

/** SecureStore keys may only use letters, digits, ".", "-" and "_". */
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

interface LegacyStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

/** The plain key-value store earlier versions used (expo-sqlite localStorage). */
function legacyStorage(): LegacyStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-sqlite/localStorage/install');
    return (globalThis as { localStorage?: LegacyStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(safeKey(key));
      if (value !== null) return value;
    } catch {
      // Unreadable (e.g. restored from another phone): sign in again.
      return null;
    }
    const legacy = legacyStorage();
    const old = legacy?.getItem(key) ?? null;
    if (old !== null) {
      try {
        await SecureStore.setItemAsync(safeKey(key), old);
      } finally {
        legacy?.removeItem(key);
      }
    }
    return old;
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(safeKey(key), value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(safeKey(key));
    legacyStorage()?.removeItem(key);
  },
};
