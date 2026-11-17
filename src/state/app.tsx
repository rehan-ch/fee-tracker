/**
 * App-wide state: the active business, the active language, premium status,
 * who is using the phone (staff role), and helpers for translated text,
 * dates and money. Also runs the monthly-dues check when the app opens or
 * comes back to the foreground.
 */
import { getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, I18nManager } from 'react-native';

import { useDataVersion } from '../db/events';
import {
  cloudStaffKey,
  currentStaffKey,
  ensureAllDues,
  getActiveBusiness,
  getMeta,
  getStaff,
  ownerStaff,
  setMeta,
} from '../db/repo';
import type { Business, Language, Staff, StaffRole } from '../db/types';
import { en, ur, type StringKey } from '../i18n/strings';
import { dayKeyToDate, monthIndex, yearOf, type DayKey, type MonthKey } from '../lib/date';
import { formatMoney } from '../lib/money';
import { can as roleCan, type Action } from '../lib/permissions';
import { cachedPremium, refreshPremium, type PremiumState } from '../premium/state';

export type TFunction = (key: StringKey, params?: Record<string, string | number>) => string;

interface AppContextValue {
  ready: boolean;
  business: Business | null;
  premium: PremiumState;
  checkPremium: () => Promise<void>;
  /** Who is using the app now (always the owner without premium staff accounts). */
  staff: Staff | null;
  role: StaffRole;
  /** True on a staff member's own phone that joined a cloud business. */
  staffLocked: boolean;
  can: (action: Action) => boolean;
  switchStaff: (staffId: string) => Promise<void>;
  staffLabel: (s: { name: string | null; role: StaffRole | string | null } | null) => string;
  lang: Language;
  /** True when the UI should read right-to-left (Urdu). */
  isRTL: boolean;
  /** Flex direction for a horizontal row that follows the reading direction. */
  rowDir: 'row' | 'row-reverse';
  t: TFunction;
  setLanguage: (lang: Language) => Promise<void>;
  monthLabel: (m: MonthKey) => string;
  shortMonthLabel: (m: MonthKey) => string;
  dateLabel: (d: DayKey) => string;
  money: (n: number) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

function deviceLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === 'ur' ? 'ur' : 'en';
  } catch {
    return 'en';
  }
}

// The app draws its own right-to-left layout for Urdu, so native RTL
// mirroring stays off (also set via the expo-localization plugin).
I18nManager.allowRTL(false);

const NO_PREMIUM: PremiumState = { active: false, source: 'none', productId: null, checkedAt: null };

interface Loaded {
  business: Business | null;
  premium: PremiumState;
  staff: Staff | null;
  staffLocked: boolean;
  /** Language picked on this phone (each staff phone can choose its own). */
  language: Language | null;
}

const META_LANGUAGE = 'language';

/** The active business, premium state and current staff member. */
async function loadState(db: ReturnType<typeof useSQLiteContext>): Promise<Loaded> {
  const business = await getActiveBusiness(db);
  const premium = await cachedPremium(db);
  const saved = await getMeta(db, META_LANGUAGE);
  const language: Language | null = saved === 'en' || saved === 'ur' ? saved : null;
  if (!business) return { business, premium, staff: null, staffLocked: false, language };
  // A staff member's own phone stays locked to them. If their staff row is
  // missing (removed by the owner, or not downloaded yet) the phone gets the
  // least access (see `role` below), never the owner's.
  const lockedId = await getMeta(db, cloudStaffKey(business.id));
  if (lockedId) {
    const locked = await getStaff(db, lockedId);
    return { business, premium, staff: locked?.business_id === business.id ? locked : null, staffLocked: true, language };
  }
  const owner = await ownerStaff(db, business.id);
  if (!premium.active) return { business, premium, staff: owner, staffLocked: false, language };
  const pickedId = await getMeta(db, currentStaffKey(business.id));
  const picked = pickedId ? await getStaff(db, pickedId) : null;
  return { business, premium, staff: picked ?? owner, staffLocked: false, language };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const version = useDataVersion();
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>({
    business: null,
    premium: NO_PREMIUM,
    staff: null,
    staffLocked: false,
    language: null,
  });
  const [draftLang, setDraftLang] = useState<Language>(deviceLanguage);
  const { business, premium, staff, staffLocked, language } = loaded;

  // Load (and reload after any write) the business, premium state and staff.
  useEffect(() => {
    let cancelled = false;
    loadState(db).then((next) => {
      if (cancelled) return;
      setLoaded(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  // Re-check the subscription with Google Play on launch and on resume.
  const checkPremium = useCallback(async () => {
    await refreshPremium(db);
  }, [db]);
  useEffect(() => {
    checkPremium();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkPremium();
    });
    return () => sub.remove();
  }, [checkPremium]);

  const switchStaff = useCallback(
    async (staffId: string) => {
      if (business) await setMeta(db, currentStaffKey(business.id), staffId);
    },
    [db, business],
  );

  // Monthly logic step 1: create this month's dues on open and on resume.
  const businessId = business?.id;
  useEffect(() => {
    if (!businessId) return;
    const run = () => {
      ensureAllDues(db).catch(() => {
        if (__DEV__) console.warn('ensureAllDues failed');
      });
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [db, businessId]);

  const lang: Language = language ?? business?.language ?? draftLang;
  const isRTL = lang === 'ur';

  // The language is a setting of this phone; the business keeps the language
  // it was created with as the default for new phones.
  const setLanguage = useCallback(
    async (next: Language) => {
      setDraftLang(next);
      if (business) await setMeta(db, META_LANGUAGE, next);
    },
    [db, business],
  );

  const value = useMemo<AppContextValue>(() => {
    const dict = lang === 'ur' ? ur : en;
    const t: TFunction = (key, params) => {
      let s = dict[key] ?? en[key];
      if (params) {
        for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
      }
      return s;
    };
    const mName = (m: MonthKey | DayKey, short: boolean) =>
      dict[`${short ? 's' : 'm'}${monthIndex(m) + 1}` as StringKey];
    // No staff row means a single-user phone (the owner), except on a locked staff phone.
    const role: StaffRole = staff?.role ?? (staffLocked ? 'collector' : 'owner');
    return {
      ready,
      business,
      premium,
      checkPremium,
      staff,
      role,
      staffLocked,
      can: (action) => roleCan(role, action),
      switchStaff,
      staffLabel: (s) => {
        if (!s) return t('unknownStaff');
        if (s.name) return s.name;
        return s.role === 'owner' ? t('roleOwner') : s.role === 'manager' ? t('roleManager') : t('roleCollector');
      },
      lang,
      isRTL,
      rowDir: isRTL !== I18nManager.isRTL ? 'row-reverse' : 'row',
      t,
      setLanguage,
      monthLabel: (m) => `${mName(m, false)} ${yearOf(m)}`,
      shortMonthLabel: (m) => mName(m, true),
      dateLabel: (d) => `${dayKeyToDate(d).getDate()} ${mName(d, true)} ${yearOf(d)}`,
      money: (n) => formatMoney(n, business?.currency ?? 'PKR'),
    };
  }, [ready, business, premium, checkPremium, staff, staffLocked, switchStaff, lang, isRTL, setLanguage]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
