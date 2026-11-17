/**
 * Test-only adapter: runs the app's repository code against Node's built-in
 * SQLite (node:sqlite, Node 22.13+) using the subset of the expo-sqlite
 * SQLiteDatabase API the app uses. Lets the real SQL and monthly logic be
 * tested without a phone.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

type Param = string | number | null;

interface NodeStatement {
  run(...params: Param[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  all(...params: Param[]): Record<string, unknown>[];
  get(...params: Param[]): Record<string, unknown> | undefined;
}
interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
}

export function createTestDatabase(): SQLiteDatabase {
  // getBuiltinModule bypasses Jest's module resolver, which doesn't know node:sqlite.
  const { process } = globalThis as unknown as {
    process: {
      getBuiltinModule: (id: string) => { DatabaseSync: new (path: string) => NodeDatabase };
    };
  };
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  const db = new DatabaseSync(':memory:');

  const norm = (params: unknown[]): Param[] => {
    const list = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
    return list.map((p) => {
      if (p === undefined) throw new Error('undefined bind parameter');
      return p as Param;
    });
  };
  const plain = <T>(row: Record<string, unknown> | undefined) => (row ? ({ ...row } as T) : null);

  const api = {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const r = db.prepare(sql).run(...norm(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return db.prepare(sql).all(...norm(params)).map((r) => ({ ...r }) as T);
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      return plain<T>(db.prepare(sql).get(...norm(params)));
    },
    async withTransactionAsync(task: () => Promise<void>) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return api as unknown as SQLiteDatabase;
}
