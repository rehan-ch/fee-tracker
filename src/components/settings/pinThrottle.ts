/**
 * Slows down guessing a staff PIN on a shared phone. After MAX_TRIES wrong
 * PINs for one person, PIN entry for that person pauses; each further pause
 * doubles (30 s, 1 min, 2 min, ... up to 1 hour) until the right PIN is
 * entered. The counts are saved on the phone (app_meta), so closing and
 * reopening the app doesn't reset them. It never stores or sees the PIN.
 *
 * Pure logic over a small key-value store, so it is unit-tested.
 */

export const MAX_TRIES = 5;
export const LOCK_MS = 30_000;
export const MAX_LOCK_MS = 60 * 60_000;

export interface ThrottleStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | null): Promise<void>;
}

interface Entry {
  wrong: number;
  lockedUntil: number;
  lockouts: number;
}

export const pinTriesKey = (staffId: string) => `pin_tries:${staffId}`;

async function load(store: ThrottleStore, staffId: string): Promise<Entry> {
  const empty: Entry = { wrong: 0, lockedUntil: 0, lockouts: 0 };
  const raw = await store.get(pinTriesKey(staffId));
  if (!raw) return empty;
  try {
    const e = JSON.parse(raw) as Partial<Entry>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    return { wrong: num(e.wrong), lockedUntil: num(e.lockedUntil), lockouts: num(e.lockouts) };
  } catch {
    return empty;
  }
}

/** Length of the n-th pause (n >= 1). */
export function lockMs(lockouts: number): number {
  return Math.min(LOCK_MS * 2 ** Math.max(0, lockouts - 1), MAX_LOCK_MS);
}

/** Seconds left before this person's PIN can be tried again (0 = allowed now). */
export async function pinWaitSeconds(store: ThrottleStore, staffId: string, now: number = Date.now()): Promise<number> {
  const e = await load(store, staffId);
  // A pause can't be longer than the longest one: a clock set back doesn't extend it forever,
  // and a clock set forward can't skip it.
  const until = Math.min(e.lockedUntil, now + MAX_LOCK_MS);
  return until > now ? Math.ceil((until - now) / 1000) : 0;
}

/** Records a wrong PIN. Returns the wait in seconds when this try started a pause, else 0. */
export async function recordWrongPin(store: ThrottleStore, staffId: string, now: number = Date.now()): Promise<number> {
  const e = await load(store, staffId);
  e.wrong += 1;
  if (e.wrong >= MAX_TRIES) {
    e.wrong = 0;
    e.lockouts += 1;
    e.lockedUntil = now + lockMs(e.lockouts);
  }
  await store.set(pinTriesKey(staffId), JSON.stringify(e));
  return pinWaitSeconds(store, staffId, now);
}

/** Clears the count after a correct PIN. */
export async function clearPinTries(store: ThrottleStore, staffId: string): Promise<void> {
  await store.set(pinTriesKey(staffId), null);
}
