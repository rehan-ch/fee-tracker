/**
 * Temporary files the app writes to its cache folder before sharing them:
 * backup JSON, receipt and report PDFs, Excel files, receipt images, and the
 * copy the file picker makes of a backup being restored. They hold customer
 * data, so "Delete all data" removes them and a new backup replaces old ones.
 */
import { Directory, File, Paths } from 'expo-file-system';

export const BACKUP_FILE_PREFIX = 'fee-tracker-backup-';

/** Root cache files with these extensions are the app's own exports. */
const EXPORT_EXT = /\.(json|pdf|xlsx|png|jpe?g)$/i;
/** Cache sub-folders used by the file picker and printing. */
const EXPORT_DIRS = ['DocumentPicker', 'Print'];

function tryDelete(entry: File | Directory) {
  try {
    if (entry.exists) entry.delete();
  } catch {
    // Already gone or in use by the app it was shared to: the OS clears the cache later.
  }
}

/** Delete earlier backup files (call before writing a new one). */
export function clearOldBackups(): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && entry.name.startsWith(BACKUP_FILE_PREFIX)) tryDelete(entry);
    }
  } catch {
    // Cache folder unreadable: nothing to clean.
  }
}

/** Delete every export and picked-file copy in the cache folder. */
export function clearExportFiles(): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && EXPORT_EXT.test(entry.name)) tryDelete(entry);
      else if (entry instanceof Directory && EXPORT_DIRS.includes(entry.name)) tryDelete(entry);
    }
  } catch {
    // Cache folder unreadable: nothing to clean.
  }
}

/** Delete one file the app copied into its cache (e.g. a picked backup), ignoring errors. */
export function deleteCacheCopy(uri: string): void {
  if (!uri.startsWith(Paths.cache.uri)) return;
  tryDelete(new File(uri));
}
