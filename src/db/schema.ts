import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'fee-tracker.db';

/**
 * Schema version written into backups. Bump it together with a new entry in
 * MIGRATIONS whenever the schema changes.
 */
export const SCHEMA_VERSION = 2;

/** Columns every table gets, so offline sync and restore work safely later. */
const TS = `
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT`;

/**
 * Tables that are backed up and synced, in an order that satisfies foreign
 * keys. `businesses` is scoped by its own id, the others by business_id.
 */
export const SYNC_TABLES = [
  'businesses',
  'areas',
  'staff',
  'customers',
  'monthly_dues',
  'payments',
  'fee_changes',
  'reminders_log',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
export const scopeColumn = (table: SyncTable) => (table === 'businesses' ? 'id' : 'business_id');

/**
 * Due ids are derived from the customer and month, so two phones that create
 * the same month's due offline end up with the same row instead of a duplicate.
 */
export const dueIdFor = (customerId: string, month: string) => `${customerId}:${month}`;

/**
 * Idempotent data repairs, run after the v2 migration and after restoring a
 * backup (which may come from version 1): fills business_id on child tables,
 * moves live dues to derived ids, and gives every business an owner staff row.
 * Runs inside a transaction; foreign keys are checked at commit.
 */
export const REPAIR_SQL = `
  PRAGMA defer_foreign_keys = ON;
  UPDATE monthly_dues SET business_id =
    (SELECT c.business_id FROM customers c WHERE c.id = monthly_dues.customer_id)
    WHERE business_id IS NULL;
  UPDATE payments SET business_id =
    (SELECT c.business_id FROM customers c WHERE c.id = payments.customer_id)
    WHERE business_id IS NULL;
  UPDATE fee_changes SET business_id =
    (SELECT c.business_id FROM customers c WHERE c.id = fee_changes.customer_id)
    WHERE business_id IS NULL;
  UPDATE payments SET monthly_due_id =
    (SELECT d.customer_id || ':' || d.month FROM monthly_dues d WHERE d.id = payments.monthly_due_id)
    WHERE monthly_due_id IN (SELECT id FROM monthly_dues
                             WHERE deleted_at IS NULL AND id <> customer_id || ':' || month);
  UPDATE reminders_log SET monthly_due_id =
    (SELECT d.customer_id || ':' || d.month FROM monthly_dues d WHERE d.id = reminders_log.monthly_due_id)
    WHERE monthly_due_id IN (SELECT id FROM monthly_dues
                             WHERE deleted_at IS NULL AND id <> customer_id || ':' || month);
  UPDATE monthly_dues SET id = customer_id || ':' || month
    WHERE deleted_at IS NULL AND id <> customer_id || ':' || month;
  INSERT INTO staff (id, business_id, name, phone, role, created_at, updated_at)
    SELECT lower(hex(randomblob(16))), b.id, '', b.phone, 'owner', b.created_at, b.created_at
    FROM businesses b
    WHERE NOT EXISTS (SELECT 1 FROM staff s
                      WHERE s.business_id = b.id AND s.role = 'owner' AND s.deleted_at IS NULL);
`;

/**
 * Change tracking for cloud sync: when a row of a cloud-linked business is
 * written locally, remember it in sync_outbox so the next sync uploads it.
 * Rows written while applying downloaded changes (sync_applying has a row)
 * are not recorded, so changes don't bounce back and forth.
 */
function syncTriggers(): string {
  return SYNC_TABLES.map((t) => {
    const scope = `NEW.${scopeColumn(t)}`;
    const body = `
      INSERT OR IGNORE INTO sync_outbox (tbl, row_id, business_id, version) VALUES ('${t}', NEW.id, ${scope}, 0);
      UPDATE sync_outbox SET version = version + 1 WHERE tbl = '${t}' AND row_id = NEW.id;`;
    const when = `WHEN NOT EXISTS (SELECT 1 FROM sync_applying)
      AND EXISTS (SELECT 1 FROM sync_links WHERE business_id = ${scope})`;
    return `
    CREATE TRIGGER sync_${t}_ins AFTER INSERT ON ${t} ${when} BEGIN ${body} END;
    CREATE TRIGGER sync_${t}_upd AFTER UPDATE ON ${t} ${when} BEGIN ${body} END;`;
  }).join('\n');
}

export const MIGRATIONS: string[] = [
  // v1: the version-1 tables from the feature plan.
  `
  CREATE TABLE businesses (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    currency TEXT NOT NULL DEFAULT 'PKR',
    language TEXT NOT NULL DEFAULT 'en',
    reminder_template TEXT,${TS}
  );

  CREATE TABLE areas (
    id TEXT PRIMARY KEY NOT NULL,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,${TS}
  );

  CREATE TABLE customers (
    id TEXT PRIMARY KEY NOT NULL,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    area_id TEXT REFERENCES areas(id),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    monthly_fee INTEGER NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,${TS}
  );
  CREATE INDEX idx_customers_area ON customers(area_id);

  CREATE TABLE monthly_dues (
    id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    month TEXT NOT NULL,
    fee_amount INTEGER NOT NULL,
    carried_forward INTEGER NOT NULL DEFAULT 0,
    total_due INTEGER NOT NULL,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('unpaid', 'partial', 'paid')),${TS}
  );
  CREATE UNIQUE INDEX idx_dues_customer_month
    ON monthly_dues(customer_id, month) WHERE deleted_at IS NULL;
  CREATE INDEX idx_dues_month_status ON monthly_dues(month, status);

  CREATE TABLE payments (
    id TEXT PRIMARY KEY NOT NULL,
    monthly_due_id TEXT NOT NULL REFERENCES monthly_dues(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    amount INTEGER NOT NULL,
    paid_on TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('cash', 'jazzcash', 'easypaisa', 'bank')),
    received_by TEXT,
    note TEXT,${TS}
  );
  CREATE INDEX idx_payments_due ON payments(monthly_due_id);
  CREATE INDEX idx_payments_customer ON payments(customer_id);
  CREATE INDEX idx_payments_paid_on ON payments(paid_on);

  CREATE TABLE fee_changes (
    id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    old_fee INTEGER NOT NULL,
    new_fee INTEGER NOT NULL,
    effective_month TEXT NOT NULL,${TS}
  );
  CREATE INDEX idx_fee_changes_customer ON fee_changes(customer_id);

  -- Small key/value store for app settings such as the last backup time.
  CREATE TABLE app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
  `,

  // v2: version-2 and premium features.
  `
  ALTER TABLE businesses ADD COLUMN payment_info TEXT;
  ALTER TABLE businesses ADD COLUMN payment_link TEXT;
  ALTER TABLE monthly_dues ADD COLUMN business_id TEXT REFERENCES businesses(id);
  ALTER TABLE payments ADD COLUMN business_id TEXT REFERENCES businesses(id);
  ALTER TABLE fee_changes ADD COLUMN business_id TEXT REFERENCES businesses(id);
  ALTER TABLE fee_changes ADD COLUMN note TEXT;

  CREATE TABLE staff (
    id TEXT PRIMARY KEY NOT NULL,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'collector')),
    -- Cloud sync: the signed-in account linked to this staff member, and the
    -- one-time code the owner shares to link it.
    user_id TEXT,
    invite_code TEXT,${TS}
  );
  CREATE INDEX idx_staff_business ON staff(business_id);

  -- PINs stay on this phone only: never backed up or synced.
  CREATE TABLE staff_pins (
    staff_id TEXT PRIMARY KEY NOT NULL,
    pin_hash TEXT NOT NULL
  );

  CREATE TABLE reminders_log (
    id TEXT PRIMARY KEY NOT NULL,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    monthly_due_id TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
    sent_at TEXT NOT NULL,
    sent_by TEXT,${TS}
  );
  CREATE INDEX idx_reminders_due ON reminders_log(monthly_due_id);
  CREATE INDEX idx_reminders_customer ON reminders_log(customer_id);

  -- Cloud sync bookkeeping (local only).
  CREATE TABLE sync_links (
    business_id TEXT PRIMARY KEY NOT NULL
  );
  CREATE TABLE sync_outbox (
    tbl TEXT NOT NULL,
    row_id TEXT NOT NULL,
    business_id TEXT,
    version INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tbl, row_id)
  );
  CREATE TABLE sync_applying (
    flag INTEGER PRIMARY KEY NOT NULL
  );

  ${REPAIR_SQL}

  CREATE INDEX idx_dues_business_month ON monthly_dues(business_id, month);
  CREATE INDEX idx_payments_business ON payments(business_id, paid_on);
  ${syncTriggers()}
  `,
];

/** Tables included in backups (the synced tables; PINs and sync state stay local). */
export const BACKUP_TABLES = SYNC_TABLES;
export type BackupTable = SyncTable;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // secure_delete: deleted rows are overwritten in the file, not just unlinked.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version += 1;
  }
}
