/**
 * Cloud sync engine (premium). Independent of the server: it talks to a
 * RemoteStore, which the Supabase client implements in production and a fake
 * implements in tests.
 *
 * How it works:
 * - Every synced table has id, updated_at and deleted_at (soft delete).
 * - Local writes to a cloud-linked business are recorded in sync_outbox by
 *   SQLite triggers (see schema.ts).
 * - push: upload outbox rows; the server keeps whichever version of a row has
 *   the newer updated_at (last write wins).
 * - pull: download rows changed on the server since the last pull and apply
 *   them the same way. Downloaded rows are written with sync_applying set, so
 *   they are not uploaded again.
 * - reconcile: balances (paid_amount, carry forward) are recomputed from the
 *   payments, so two phones that took payments offline end up agreeing.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyDataChanged } from '../db/events';
import { ensureAllDues, exclusive, reconcileCustomer } from '../db/repo';
import { scopeColumn, SYNC_TABLES, type SyncTable } from '../db/schema';
import { cleanRow } from '../lib/rowSchema';

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

/** Position in a table's change feed: server time and row id of the last row seen. */
export interface Cursor {
  ts: string;
  id: string;
}

export interface PullPage {
  rows: Row[];
  /** Cursor after the last row, or null when there were no rows. */
  next: Cursor | null;
}

export interface RemoteStore {
  /** Upsert rows; the server keeps the newer updated_at. Rows the user may not write are skipped. */
  push(table: SyncTable, rows: Row[]): Promise<void>;
  /**
   * Rows of one business changed after `since`, oldest first. When
   * `overlap` is set, the server also returns rows from a short window before
   * `since`, in case a slow transaction committed late.
   */
  pull(table: SyncTable, businessId: string, since: Cursor | null, limit: number, overlap: boolean): Promise<PullPage>;
}

const PUSH_BATCH = 200;
const PULL_PAGE = 500;
const cursorKey = (businessId: string, table: SyncTable) => `sync_cursor:${businessId}:${table}`;

// ---------------------------------------------------------------------------
// Linking
// ---------------------------------------------------------------------------

export async function isLinked(db: SQLiteDatabase, businessId: string): Promise<boolean> {
  return !!(await db.getFirstAsync('SELECT 1 FROM sync_links WHERE business_id = ?', businessId));
}

export async function linkedBusinesses(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ business_id: string }>('SELECT business_id FROM sync_links');
  return rows.map((r) => r.business_id);
}

/**
 * Start syncing a business. With `uploadAll`, every existing row is queued
 * for upload (the owner turning sync on); a phone that joins an existing
 * cloud business starts empty and only downloads.
 */
export async function linkBusiness(db: SQLiteDatabase, businessId: string, uploadAll: boolean): Promise<void> {
  await exclusive(async () => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT OR IGNORE INTO sync_links (business_id) VALUES (?)', businessId);
      if (!uploadAll) return;
      for (const table of SYNC_TABLES) {
        await db.runAsync(
          `INSERT OR IGNORE INTO sync_outbox (tbl, row_id, business_id, version)
           SELECT ?, id, ?, 1 FROM ${table} WHERE ${scopeColumn(table)} = ?`,
          table,
          businessId,
          businessId,
        );
      }
    });
  });
}

/** Stop syncing a business on this phone. Its local data stays. */
export async function unlinkBusiness(db: SQLiteDatabase, businessId: string): Promise<void> {
  await exclusive(async () => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM sync_links WHERE business_id = ?', businessId);
      await db.runAsync('DELETE FROM sync_outbox WHERE business_id = ?', businessId);
      await db.runAsync("DELETE FROM app_meta WHERE key LIKE 'sync_cursor:' || ? || ':%'", businessId);
    });
  });
}

export async function pendingChanges(db: SQLiteDatabase, businessId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_outbox WHERE business_id = ?',
    businessId,
  );
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

interface OutboxEntry {
  tbl: SyncTable;
  row_id: string;
  version: number;
}

async function push(db: SQLiteDatabase, remote: RemoteStore, businessId: string): Promise<number> {
  let pushed = 0;
  // Each pass uploads up to PUSH_BATCH entries; entries changed again while
  // uploading keep a higher version and go in the next pass or sync.
  for (let pass = 0; pass < 1000; pass++) {
    const entries = await db.getAllAsync<OutboxEntry>(
      'SELECT tbl, row_id, version FROM sync_outbox WHERE business_id = ? LIMIT ?',
      businessId,
      PUSH_BATCH,
    );
    if (entries.length === 0) break;
    for (const table of SYNC_TABLES) {
      const ids = entries.filter((e) => e.tbl === table).map((e) => e.row_id);
      if (ids.length === 0) continue;
      const rows = await db.getAllAsync<Row>(
        `SELECT * FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      );
      if (rows.length > 0) await remote.push(table, rows);
      pushed += rows.length;
    }
    await exclusive(async () => {
      await db.withTransactionAsync(async () => {
        for (const e of entries) {
          await db.runAsync(
            'DELETE FROM sync_outbox WHERE tbl = ? AND row_id = ? AND version = ?',
            e.tbl,
            e.row_id,
            e.version,
          );
        }
      });
    });
  }
  return pushed;
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

const columnCache = new WeakMap<SQLiteDatabase, Map<string, string[]>>();

async function localColumns(db: SQLiteDatabase, table: SyncTable): Promise<string[]> {
  let byTable = columnCache.get(db);
  if (!byTable) {
    byTable = new Map();
    columnCache.set(db, byTable);
  }
  let cols = byTable.get(table);
  if (!cols) {
    cols = (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);
    byTable.set(table, cols);
  }
  return cols;
}

/** Columns that point at another table's row, per table. */
const REFERENCES: Record<SyncTable, [column: string, table: SyncTable][]> = {
  businesses: [],
  areas: [],
  staff: [],
  customers: [['area_id', 'areas']],
  monthly_dues: [['customer_id', 'customers']],
  payments: [
    ['customer_id', 'customers'],
    ['monthly_due_id', 'monthly_dues'],
    ['received_by', 'staff'],
  ],
  fee_changes: [['customer_id', 'customers']],
  reminders_log: [
    ['customer_id', 'customers'],
    ['sent_by', 'staff'],
  ],
};

/** Which business each of these local rows belongs to (rows not on this phone are left out). */
async function ownersOf(db: SQLiteDatabase, table: SyncTable, ids: string[]): Promise<Map<string, string | null>> {
  const owners = new Map<string, string | null>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 400) {
    const chunk = unique.slice(i, i + 400);
    const rows = await db.getAllAsync<{ id: string; owner: string | null }>(
      `SELECT id, ${scopeColumn(table)} AS owner FROM ${table} WHERE id IN (${chunk.map(() => '?').join(',')})`,
      ...chunk,
    );
    for (const r of rows) owners.set(r.id, r.owner);
  }
  return owners;
}

/**
 * Keep only downloaded rows that are safe to write: valid values (see
 * lib/rowSchema), belonging to the business being synced, and not pointing at
 * another business's customers, dues or staff on this phone. Whatever the
 * server sends, a sync can only change the business it is syncing.
 */
async function acceptedRows(db: SQLiteDatabase, table: SyncTable, businessId: string, rows: Row[]): Promise<Row[]> {
  const scope = scopeColumn(table);
  const clean = rows
    .map((r) => cleanRow(table, r))
    .filter((r): r is Row => r !== null && r[scope] === businessId);
  const refs = REFERENCES[table];
  if (refs.length === 0 || clean.length === 0) return clean;
  const owners = new Map<string, Map<string, string | null>>();
  for (const [col, ref] of refs) {
    const ids = clean.map((r) => r[col]).filter((v): v is string => typeof v === 'string');
    owners.set(col, await ownersOf(db, ref, ids));
  }
  return clean.filter((r) =>
    refs.every(([col]) => {
      const v = r[col];
      if (typeof v !== 'string') return true;
      const owner = owners.get(col)?.get(v);
      // Not on this phone yet (it may arrive later), or in this business.
      return owner === undefined || owner === businessId;
    }),
  );
}

/**
 * Write downloaded rows when they are newer than the local copy. Foreign
 * keys are off while applying, because a child row can arrive before its
 * parent (the parent then arrives in the next sync). Returns the customers
 * whose balances may have changed.
 */
async function applyRows(
  db: SQLiteDatabase,
  table: SyncTable,
  businessId: string,
  downloaded: Row[],
): Promise<{ affected: Set<string>; applied: number; rejected: number }> {
  const affected = new Set<string>();
  let applied = 0;
  if (downloaded.length === 0) return { affected, applied, rejected: 0 };
  const local = await localColumns(db, table);
  const scope = scopeColumn(table);
  let rows: Row[] = [];
  await exclusive(async () => {
    rows = await acceptedRows(db, table, businessId, downloaded);
    if (rows.length === 0) return;
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('INSERT OR IGNORE INTO sync_applying (flag) VALUES (1)');
        for (const row of rows) {
          const cols = local.filter((c) => c in row);
          if (!cols.includes('id') || !cols.includes('updated_at')) continue;
          const updates = cols.filter((c) => c !== 'id').map((c) => `"${c}" = excluded."${c}"`);
          // Column names come from this phone's own schema, values are bound.
          // A row with the same id in another business is never overwritten.
          const result = await db.runAsync(
            `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')})
             VALUES (${cols.map(() => '?').join(', ')})
             ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}
             WHERE excluded.updated_at > ${table}.updated_at AND ${table}.${scope} IS excluded.${scope}`,
            cols.map((c) => row[c] ?? null),
          );
          if (result.changes > 0) {
            applied += 1;
            if (table === 'customers') affected.add(String(row.id));
            else if (typeof row.customer_id === 'string') affected.add(row.customer_id);
          }
        }
        await db.runAsync('DELETE FROM sync_applying');
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON');
    }
  });
  return { affected, applied, rejected: downloaded.length - rows.length };
}

async function getCursor(db: SQLiteDatabase, businessId: string, table: SyncTable): Promise<Cursor | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_meta WHERE key = ?',
    cursorKey(businessId, table),
  );
  if (!row?.value) return null;
  try {
    const c = JSON.parse(row.value) as Cursor;
    return typeof c.ts === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

async function saveCursor(db: SQLiteDatabase, businessId: string, table: SyncTable, cursor: Cursor) {
  await exclusive(() =>
    db.runAsync(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      cursorKey(businessId, table),
      JSON.stringify(cursor),
    ),
  );
}

async function pull(db: SQLiteDatabase, remote: RemoteStore, businessId: string) {
  const affected = new Set<string>();
  let pulled = 0;
  let applied = 0;
  let rejected = 0;
  for (const table of SYNC_TABLES) {
    let cursor = await getCursor(db, businessId, table);
    let first = true;
    for (let page = 0; page < 10000; page++) {
      const res = await remote.pull(table, businessId, cursor, PULL_PAGE, first && cursor !== null);
      first = false;
      const r = await applyRows(db, table, businessId, res.rows);
      for (const id of r.affected) affected.add(id);
      applied += r.applied;
      rejected += r.rejected;
      pulled += res.rows.length;
      if (!res.next) break;
      cursor = res.next;
      await saveCursor(db, businessId, table, cursor);
      if (res.rows.length < PULL_PAGE) break;
    }
  }
  return { affected, pulled, applied, rejected };
}

// ---------------------------------------------------------------------------
// Full sync
// ---------------------------------------------------------------------------

export interface SyncResult {
  pushed: number;
  /** Rows downloaded, and how many of them changed something here. */
  pulled: number;
  applied: number;
  /** Downloaded rows that failed the checks in acceptedRows and were left out. */
  rejected: number;
}

/** Sync one business: upload, download, recompute balances, upload the result. */
export async function syncBusiness(
  db: SQLiteDatabase,
  remote: RemoteStore,
  businessId: string,
): Promise<SyncResult> {
  let pushed = await push(db, remote, businessId);
  const { affected, pulled, applied, rejected } = await pull(db, remote, businessId);
  if (affected.size > 0) {
    await exclusive(async () => {
      await db.withTransactionAsync(async () => {
        for (const id of affected) await reconcileCustomer(db, id);
      });
    });
  }
  // New customers from other phones may need dues for months they haven't
  // been opened in yet.
  await ensureAllDues(db);
  pushed += await push(db, remote, businessId);
  if (applied > 0) notifyDataChanged();
  return { pushed, pulled, applied, rejected };
}
