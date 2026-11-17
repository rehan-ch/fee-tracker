/**
 * Premium state. Google Play Billing is not shipped yet (see `PREMIUM` in
 * config.ts), so this only decides whether premium features are unlocked:
 * always, while `PREMIUM.enforce` is false. When subscriptions are added,
 * this is where the store check and its on-device cache go.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { PREMIUM } from '../config';

export interface PremiumState {
  active: boolean;
  /** store: a subscription is active; free: premium isn't enforced; none: locked. */
  source: 'store' | 'free' | 'none';
  productId: string | null;
  checkedAt: string | null;
}

const FREE: PremiumState = { active: true, source: 'free', productId: null, checkedAt: null };
const NONE: PremiumState = { active: false, source: 'none', productId: null, checkedAt: null };

/** Premium state known on this phone, without contacting any store. */
export async function cachedPremium(_db: SQLiteDatabase): Promise<PremiumState> {
  return PREMIUM.enforce ? NONE : FREE;
}

/** Re-check premium with the store. Without billing this is the cached state. */
export async function refreshPremium(db: SQLiteDatabase): Promise<PremiumState> {
  return cachedPremium(db);
}
