/**
 * Backup and restore.
 *
 * Backup writes every table to a JSON file and opens the Android share sheet,
 * where the user picks Google Drive (or any other app) to save it. Restore
 * opens the system file picker, where Google Drive also appears. This needs
 * no Google sign-in and no extra permissions.
 */
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { META_LAST_BACKUP, repairData, setMeta, writeTx } from '../db/repo';
import { BACKUP_TABLES, SCHEMA_VERSION, type BackupTable } from '../db/schema';
import type { TFunction } from '../state/app';
import { nowIso, toDayKey } from './date';
import { BACKUP_FILE_PREFIX, clearOldBackups, deleteCacheCopy } from './exportFiles';
import { cleanRow, isIsoTimestamp, type Row } from './rowSchema';
import { showToast } from './toast';

export const BACKUP_APP_ID = 'fee-tracker';

/**
 * Largest backup file restored. A business with a few thousand customers and
 * years of payments is a few MB; anything far bigger is not one of ours and
 * would only exhaust memory.
 */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

/**
 * Columns never written to or restored from a backup: one-time invite codes
 * are secrets (anyone holding one could join the business), and a restored
 * old code must not become valid again.
 */
const SECRET_COLUMNS: Partial<Record<BackupTable, string[]>> = { staff: ['invite_code'] };

function withoutSecrets(table: BackupTable, row: Row): Row {
  const secret = SECRET_COLUMNS[table];
  if (!secret) return row;
  const copy = { ...row };
  for (const col of secret) if (col in copy) copy[col] = null;
  return copy;
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schema_version: number;
  app_version: string | null;
  exported_at: string;
  data: Record<BackupTable, Row[]>;
}

export async function exportBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const data = {} as Record<BackupTable, Row[]>;
  for (const table of BACKUP_TABLES) {
    const rows = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
    data[table] = rows.map((r) => withoutSecrets(table, r));
  }
  return {
    app: BACKUP_APP_ID,
    schema_version: SCHEMA_VERSION,
    app_version: Constants.expoConfig?.version ?? null,
    exported_at: nowIso(),
    data,
  };
}

export class BackupError extends Error {
  constructor(public kind: 'invalid' | 'newer') {
    super(kind);
  }
}

/**
 * Validate an untrusted parsed JSON value as a backup file. Every row must
 * pass the column checks in rowSchema (ids, types, sizes, dates, allowed
 * values); one bad row rejects the whole file, so nothing is half-restored.
 */
export function parseBackup(value: unknown): BackupFile {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isObj(value) || value.app !== BACKUP_APP_ID) throw new BackupError('invalid');
  const version = value.schema_version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupError('invalid');
  }
  if (version > SCHEMA_VERSION) throw new BackupError('newer');
  if (!isObj(value.data)) throw new BackupError('invalid');
  const data = {} as Record<BackupTable, Row[]>;
  // Tables added in version 2 are missing from version-1 backups.
  const added: BackupTable[] = ['staff', 'reminders_log'];
  for (const table of BACKUP_TABLES) {
    const rows = value.data[table] ?? (version < 2 && added.includes(table) ? [] : undefined);
    if (!Array.isArray(rows)) throw new BackupError('invalid');
    data[table] = cleanRows(table, rows);
  }
  if (data.businesses.filter((b) => !b.deleted_at).length === 0) throw new BackupError('invalid');
  return {
    app: BACKUP_APP_ID,
    schema_version: version,
    app_version: typeof value.app_version === 'string' ? value.app_version.slice(0, 40) : null,
    exported_at: typeof value.exported_at === 'string' && isIsoTimestamp(value.exported_at) ? value.exported_at : '',
    data,
  };
}

/** Checked copies of a table's rows, without secrets; throws on the first bad row. */
function cleanRows(table: BackupTable, rows: unknown[]): Row[] {
  return rows.map((raw) => {
    const row = cleanRow(table, raw);
    if (!row) throw new BackupError('invalid');
    return withoutSecrets(table, row);
  });
}

/** Replace all data with the backup, atomically (all or nothing). */
export async function importBackup(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  // Only insert columns that exist in this app's schema.
  const columns = {} as Record<BackupTable, Set<string>>;
  for (const table of BACKUP_TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columns[table] = new Set(info.map((c) => c.name));
  }
  // Checked again here: this is the only way rows from a file reach the database.
  const data = {} as Record<BackupTable, Row[]>;
  for (const table of BACKUP_TABLES) data[table] = cleanRows(table, backup.data[table] ?? []);
  await writeTx(db, async () => {
    for (const table of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    await db.runAsync('DELETE FROM staff_pins');
    for (const table of BACKUP_TABLES) {
      for (const row of data[table]) {
        // Column names only from this app's schema; values are bound parameters.
        const cols = Object.keys(row).filter((c) => columns[table].has(c));
        const sql = `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')})
                     VALUES (${cols.map(() => '?').join(', ')})`;
        await db.runAsync(sql, cols.map((c) => row[c]));
      }
    }
    // Older backups: fill new columns, derived due ids and owner staff.
    await repairData(db);
    // The restored rows replace what this phone had, so this phone's position
    // in any cloud sync no longer applies: download everything again.
    await db.runAsync(
      "DELETE FROM app_meta WHERE key LIKE 'sync_cursor:%' OR key LIKE 'current_staff:%' OR key = 'active_business'",
    );
  });
}

// ---------------------------------------------------------------------------
// UI flows
// ---------------------------------------------------------------------------

export async function runBackup(db: SQLiteDatabase, t: TFunction): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t('sharingUnavailable'));
      return;
    }
    const payload = await exportBackup(db);
    // Only the newest backup stays in the app's cache folder.
    clearOldBackups();
    const file = new File(Paths.cache, `${BACKUP_FILE_PREFIX}${toDayKey(new Date())}.json`);
    if (file.exists) file.delete();
    file.create();
    await file.write(JSON.stringify(payload));
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: t('backupNow'),
    });
    await setMeta(db, META_LAST_BACKUP, nowIso());
  } catch {
    // Never log the error object: it can quote customer data.
    if (__DEV__) console.warn('Backup failed');
    Alert.alert(t('backupFailed'));
  }
}

/**
 * Pick a backup file and, after the user confirms, replace all data with it.
 * `allowed` is checked again when the user confirms (the role can change
 * while the dialog is open): restoring replaces staff and removes PINs, so
 * only the owner may do it.
 */
export async function pickAndRestore(
  db: SQLiteDatabase,
  t: TFunction,
  formatDate: (iso: string) => string,
  allowed: () => boolean,
): Promise<void> {
  if (!allowed()) return;
  let backup: BackupFile;
  let picked: string | null = null;
  try {
    const res = await DocumentPicker.getDocumentAsync({
      // Google Drive often reports JSON as a generic type, so accept any file
      // and validate the contents instead.
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    picked = asset.uri;
    const file = new File(asset.uri);
    if ((asset.size ?? 0) > MAX_BACKUP_BYTES || file.size > MAX_BACKUP_BYTES) throw new BackupError('invalid');
    const text = await file.text();
    backup = parseBackup(JSON.parse(text));
  } catch (e) {
    Alert.alert(
      t('restoreBackup'),
      e instanceof BackupError && e.kind === 'newer' ? t('restoreNewer') : t('restoreInvalid'),
    );
    return;
  } finally {
    // The picker's copy holds every customer's details: don't leave it in the cache.
    if (picked) deleteCacheCopy(picked);
  }

  const customers = backup.data.customers.filter((c) => !c.deleted_at).length;
  const payments = backup.data.payments.filter((p) => !p.deleted_at).length;
  Alert.alert(
    t('restoreConfirmTitle'),
    t('restoreConfirm', {
      date: backup.exported_at ? formatDate(backup.exported_at) : '?',
      customers,
      payments,
    }),
    [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('restore'),
        style: 'destructive',
        onPress: async () => {
          if (!allowed()) return;
          try {
            await importBackup(db, backup);
            showToast(t('restoreDone'), true);
          } catch {
            // Never log the error object: it can quote customer data.
            if (__DEV__) console.warn('Restore failed');
            Alert.alert(t('restoreBackup'), t('restoreInvalid'));
          }
        },
      },
    ],
  );
}
